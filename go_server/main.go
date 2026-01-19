package main

import (
	"database/sql"
	"log"

	"github.com/gin-gonic/gin"
	"github.com/trevor-tan03/YouTube-Music-Tracker/api"
	_ "modernc.org/sqlite"
)

func main() {
	router := gin.Default()

	db, err := sql.Open("sqlite", "../server/youtube-music-tracker.db")
	if err != nil {
		log.Fatal(err)
	}

	handler := api.NewHandler(db)
	defer db.Close()

	router.POST("/listen", handler.AddSongListeningTime)
	router.POST("/classify", handler.ClassifyVideo)
	router.POST("/anaylse", handler.AnalyseVideo)
	router.GET("/top-listens", handler.GetTopListens)
	router.GET("/videos", handler.GetVideos)

	router.Run("localhost:8080")
}
