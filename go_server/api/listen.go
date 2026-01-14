package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type ListeningSession struct {
	SessionID     string `json:"sessionId"`
	ListeningTime uint32 `json:"listeningTime"`
}

func AddSongListeningTime(c *gin.Context) {
	var listeningSession ListeningSession

	if err := c.BindJSON(&listeningSession); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
	}

	// Confirm specified sessionID exists in the database

	// Update the session with cumulative time
	//
	//
	//
}
