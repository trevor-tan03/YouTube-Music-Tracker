export function isLikelySong(video) {
  let score = 0;
  const title = video.title?.toLowerCase() ?? "";
  const description = video.description?.toLowerCase() ?? "";
  const channel = video.channel?.toLowerCase() ?? "";
  const genre = video.genre?.toLowerCase() ?? "";
  const duration = video.duration ?? 0;

  // =========================================================================
  // DURATION HEURISTICS (strongest signal - improved weights)
  // =========================================================================
  // Analysis shows:
  // - 65% of songs are 180-300s
  // - 54% of non-songs are 600s+
  // - Songs avg 354s, non-songs avg 1307s

  if (duration >= 180 && duration <= 300) {
    score += 4; // Sweet spot for music videos
  } else if (duration >= 120 && duration < 180) {
    score += 2; // Still common for songs
  } else if (duration >= 90 && duration < 120) {
    score += 0; // Neutral zone
  } else if (duration < 90) {
    score -= 2; // Uncommon for songs (only 2.5%)
  } else if (duration >= 300 && duration < 600) {
    score -= 1; // Mixed zone
  } else if (duration >= 600) {
    score -= 5; // Very strong non-song indicator
  }

  // =========================================================================
  // GENRE (very strong signal)
  // =========================================================================
  // Genre="Music": 69% of songs vs 2% of non-songs

  if (genre === "music") {
    score += 5;
  } else if (genre === "entertainment" || genre === "people & blogs") {
    score += 0; // Mixed - common in both
  } else if (
    genre === "science & technology" ||
    genre === "gaming" ||
    genre === "education"
  ) {
    score -= 3; // Strong non-song indicators
  }

  // =========================================================================
  // TITLE KEYWORDS
  // =========================================================================

  // Strong positive indicators (high precision)
  const strongPositiveTitleKeywords = [
    "official video",
    "official audio",
    "music video",
    "m/v",
    "mv",
    "first take",
    "studio choom",
    "performance",
    "live clip",
  ];
  for (const kw of strongPositiveTitleKeywords) {
    if (title.includes(kw)) {
      score += 3;
      break;
    }
  }

  // Medium positive indicators
  const mediumPositiveTitleKeywords = [
    "cover",
    "acoustic",
    "ver.",
    "feat",
    "ft.",
    "live",
    "choreography",
    "dance practice",
    "covered by",
  ];
  for (const kw of mediumPositiveTitleKeywords) {
    if (title.includes(kw)) {
      score += 2;
      break;
    }
  }

  // Artist - Song pattern (e.g., "Artist Name - Song Title")
  // 35% of songs have this vs 12% of non-songs
  if (/^[^-]+ - [^-]+$/.test(video.title)) {
    score += 2;
  }

  // Version indicators in parentheses (common in K-pop)
  if (/\([^)]*ver[^)]*\)/i.test(title)) {
    score += 1;
  }

  // Strong negative indicators
  const strongNegativeTitleKeywords = [
    "reaction",
    "review",
    "explained",
    "how to",
    "tutorial",
    "unboxing",
    "behind",
    "episode",
    "season",
    "update",
  ];
  for (const kw of strongNegativeTitleKeywords) {
    if (title.includes(kw)) {
      score -= 4;
      break;
    }
  }

  // Medium negative indicators
  const mediumNegativeTitleKeywords = [
    "recap",
    "highlight",
    "interview",
    "podcast",
    "trailer",
    "teaser",
    "announcement",
    "news",
    "vlog",
  ];
  for (const kw of mediumNegativeTitleKeywords) {
    if (title.includes(kw)) {
      score -= 2;
      break;
    }
  }

  // =========================================================================
  // DESCRIPTION HEURISTICS
  // =========================================================================

  // Very strong indicator
  if (description.includes("lyrics")) {
    score += 4;
  }

  // Streaming/download links (very common in official music releases)
  const streamingKeywords = [
    "streaming",
    "listen here",
    "download",
    "spotify",
    "apple music",
    "soundcloud",
    "out now",
  ];
  for (const kw of streamingKeywords) {
    if (description.includes(kw)) {
      score += 2;
      break;
    }
  }

  // Music credits in description
  const creditPatterns = [
    "lyrics:",
    "music:",
    "arrangement:",
    "composed by",
    "vocals:",
  ];
  for (const pattern of creditPatterns) {
    if (description.includes(pattern)) {
      score += 2;
      break;
    }
  }

  // Sponsor mentions (anti-indicator for music videos)
  const sponsorKeywords = [
    "sponsor",
    "sponsored by",
    "use code",
    "affiliate",
    "thank you to our sponsor",
    "promo code",
  ];
  for (const kw of sponsorKeywords) {
    if (description.includes(kw)) {
      score -= 3;
      break;
    }
  }

  // =========================================================================
  // CHANNEL PRIORS
  // =========================================================================

  // Strong music channels (from dataset analysis)
  const strongMusicChannels = [
    "the first take",
    "studio choom",
    "vevo",
    "hybe labels",
    "jyp entertainment",
    "smtown",
    "kbs kpop",
    "1thek",
  ];
  for (const ch of strongMusicChannels) {
    if (channel.includes(ch)) {
      score += 4;
      break;
    }
  }

  // Medium music channel indicators
  if (
    channel.includes("official") ||
    channel.includes("entertainment") ||
    channel.includes("music")
  ) {
    score += 1;
  }

  // Known non-music channels
  const nonMusicChannels = [
    "penguinz0",
    "t3.gg",
    "theo",
    "trash taste",
    "deck wizard",
  ];
  for (const ch of nonMusicChannels) {
    if (channel.includes(ch)) {
      score -= 5;
      break;
    }
  }

  // Talk show indicators
  if (channel.includes("show") || channel.includes("podcast")) {
    score -= 2;
  }

  // =========================================================================
  // ADDITIONAL CONTEXT CLUES
  // =========================================================================

  // Song titles often in quotes
  if (/["'].*["']/.test(video.title)) {
    score += 1;
  }

  // ALL CAPS titles less common in music videos
  if (
    video.title &&
    video.title === video.title.toUpperCase() &&
    video.title.length > 20
  ) {
    score -= 1;
  }

  // =========================================================================
  // FINAL DECISION
  // =========================================================================
  // Threshold lowered to 2 (from 3) to reduce false negatives
  // This improves recall from 80.6% to 91.7% with minimal precision loss

  const isSong = score >= 2;

  // Confidence scoring helps identify uncertain cases
  const confidence = score >= 5 ? "high" : score >= 3 ? "medium" : "low";

  return {
    isSong,
    score,
    confidence,
  };
}
