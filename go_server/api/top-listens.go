package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Song struct {
	VideoID  string `json:"video_id"`
	Title    string `json:"title"`
	Channel  string `json:"channel"`
	Duration string `json:"duration"`
	IsSong   bool   `json:"is_song"`
}

func (h *Handler) GetTopListens(c *gin.Context) {
	var listeningSession ListeningSession

	if err := c.BindJSON(&listeningSession); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
	}

	// Confirm specified sessionID exists in the database

	// Update the session with cumulative time
	//
	//
	//
	//

	c.JSON(http.StatusOK, "LOL")
}
