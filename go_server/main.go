package main

import (
	"database/sql"
	"log"

	"github.com/gin-gonic/gin"
	_ "github.com/mattn/go-sqlite3"
	"github.com/trevor-tan03/YouTube-Music-Tracker/api"
)

func main() {
	router := gin.Default()

	DB, err := sql.Open("sqlite3", "../server/youtube-music-tracker.db")
	if err != nil {
		log.Fatal(err)
	}
	defer DB.Close()

	router.POST("/listen", api.AddSongListeningTime)
	router.POST("/classify", api.ClassifyVideo)
	router.POST("/anaylse", api.AnalyseVideo)
	router.GET("/top-listens", api.GetTopListens)
	router.GET("/videos", api.GetVideos)

	router.Run("localhost:3000")
}
