package api

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

type VideoResponse struct {
	ID            string `json:"id"`
	Title         string `json:"title"`
	Channel       string `json:"channel"`
	Duration      int    `json:"duration"`
	IsSong        bool   `json:"is_song"`
	ListeningTime int    `json:"listening_time"`
	ThumbnailURL  string `json:"thumbnail_url"`
	CreatedAt     *int   `json:"created_at"`
	PlayCount     *int   `json:"play_count"`
}

type Pagination struct {
	Total      int  `json:"total"`
	Limit      int  `json:"limit"`
	Offset     int  `json:"offset"`
	HasMore    bool `json:"hasMore"`
	NextOffset int  `json:"nextOffset"`
}

func (h *Handler) GetVideos(c *gin.Context) {
	// var videoMetaData YouTubeMetaData

	limit := 50 // Load 50 results at a time
	offsetParam := c.DefaultQuery("offset", "0")
	searchFilter := c.DefaultQuery("search", "")
	classification := c.Query("classification")
	sortBy := c.DefaultQuery("sortBy", "recent")

	var offset int
	var whereConditions []string
	var params []any
	var orderBy string
	whereClause := ""

	if searchFilter != "" {
		whereConditions = append(whereConditions, "(v.title LIKE ? OR v.channel LIKE ?)")
		searchPattern := "%" + searchFilter + "%"
		params = append(params, searchPattern, searchPattern)
	}

	switch classification {
	case "song":
		whereConditions = append(whereConditions, "v.is_song = 1")
	case "video":
		whereConditions = append(whereConditions, "v.is_song = 0")
	case "unknown":
		whereConditions = append(whereConditions, "v.is_song IS NULL")
	}

	if len(whereConditions) > 0 {
		whereClause = "WHERE " + strings.Join(whereConditions, " AND ")
	}

	if offsetInt, err := strconv.ParseInt(offsetParam, 10, 64); err != nil {
		offset = 0
	} else {
		offset = int(offsetInt)
	}

	switch sortBy {
	case "oldest":
		orderBy = "v.created_at DESC"
	case "title":
		orderBy = "v.title COLLATE NOCASE ASC"
	case "duration-desc":
		orderBy = "v.duration DESC"
	case "most-played":
		orderBy = "total_listening_time DESC"
	default:
		orderBy = "v.created_at ASC"
	}

	query := `
	SELECT
			v.id,
			v.title,
			v.channel,
			v.duration,
			v.is_song,
			v.thumbnail_url,
			v.created_at,
			COALESCE(SUM(ls.listening_time), 0) as total_listening_time,
			CASE
				WHEN v.duration > 0 THEN CAST(SUM(ls.listening_time) / v.duration AS FLOAT)
				ELSE 0
			END AS play_count
	FROM video v
	LEFT JOIN listening_session ls ON ls.video_id = v.id
	` + whereClause + `
	GROUP BY v.id
	ORDER BY ` + orderBy + `
	LIMIT ? OFFSET ?
	`

	fmt.Println(whereClause)

	params = append(params, limit, offset)

	rows, err := h.DB.Query(query, params...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	// Parse results
	var videos []VideoResponse
	for rows.Next() {
		var video VideoResponse
		err := rows.Scan(
			&video.ID,
			&video.Title,
			&video.Channel,
			&video.Duration,
			&video.IsSong,
			&video.ThumbnailURL,
			&video.CreatedAt,
			&video.ListeningTime,
			&video.PlayCount,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		videos = append(videos, video)
	}

	if err = rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get total count for pagination
	countQuery := `
		SELECT COUNT(DISTINCT v.id)
		FROM video v
		LEFT JOIN main_song ms ON v.id = ms.video_id
		` + whereClause

	var totalCount int
	err = h.DB.QueryRow(countQuery, params[:len(params)-2]...).Scan(&totalCount) // exclude limit and offset
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	nextOffset := 0
	if offset+limit < totalCount {
		nextOffset = offset + limit
	}

	pagination := Pagination{
		Total:      totalCount,
		Limit:      limit,
		Offset:     offset,
		HasMore:    offset+limit < totalCount,
		NextOffset: nextOffset,
	}

	c.JSON(http.StatusOK, gin.H{
		"videos":     videos,
		"pagination": pagination,
	})
}
