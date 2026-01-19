package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type VideoClassification struct {
	VideoID string `json:"video_id"`
	IsSong  bool   `json:"is_song"`
}

type classifyResponse struct {
	Message string `json:"message"`
	IsSong  bool   `json:"is_song"`
}

func (h *Handler) ClassifyVideo(c *gin.Context) {
	var videoClassification VideoClassification

	if err := c.BindJSON(&videoClassification); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
	}

	existingVideo, err := h.DB.Query("SELECT id FROM video WHERE id = ?", videoClassification.VideoID)
	if err != nil {
		c.JSON(http.StatusNotFound, "Video with id: "+videoClassification.VideoID+" not found.")
	}

	c.JSON(http.StatusOK, existingVideo)
}
