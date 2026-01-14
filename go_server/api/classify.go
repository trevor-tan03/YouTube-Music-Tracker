package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type VideoClassification struct {
	VideoID string `json:"video_id"`
	IsSong  bool   `json:"is_song"`
}

func ClassifyVideo(c *gin.Context) {
	var videoClassification VideoClassification

	if err := c.BindJSON(&videoClassification); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
	}
}
