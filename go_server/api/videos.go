package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func GetVideos(c *gin.Context) {
	var videoMetaData YouTubeMetaData

	if err := c.BindJSON(&videoMetaData); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
	}
}
