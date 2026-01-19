package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type YouTubeMetaData struct {
	Title       string `json:"title"`
	Channel     string `json:"channel"`
	Description string `json:"description"`
	VideoID     string `json:"video_id"`
	Genre       string `json:"genre"`
}

func (h *Handler) AnalyseVideo(c *gin.Context) {
	var videoMetaData YouTubeMetaData

	if err := c.BindJSON(&videoMetaData); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
	}

	c.JSON(http.StatusOK, "LOL")
}
