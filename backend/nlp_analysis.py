"""
NLP analysis for lyrics: sentiment, emotion, and translation.
Uses multilingual models from Hugging Face transformers.
"""
from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
from typing import List, Dict, Optional
import logging
import numpy as np

logger = logging.getLogger(__name__)

# Global pipelines (lazy loaded)
_sentiment_pipeline = None
_emotion_pipeline = None


def get_sentiment_pipeline():
    """Get or initialize multilingual sentiment analysis pipeline."""
    global _sentiment_pipeline
    if _sentiment_pipeline is None:
        try:
            # Use a multilingual sentiment model (lazy load, don't block startup)
            logger.info("Loading sentiment analysis model...")
            _sentiment_pipeline = pipeline(
                "sentiment-analysis",
                model="nlptown/bert-base-multilingual-uncased-sentiment",
                device=-1,  # CPU
                model_kwargs={"local_files_only": False}
            )
        except Exception as e:
            logger.warning(f"Could not load sentiment model: {e}. Using fallback.")
            _sentiment_pipeline = None
    return _sentiment_pipeline


def get_emotion_pipeline():
    """Get or initialize emotion classification pipeline."""
    global _emotion_pipeline
    if _emotion_pipeline is None:
        try:
            # Use a multilingual emotion model (lazy load)
            logger.info("Loading emotion analysis model...")
            model_name = "j-hartmann/emotion-english-distilroberta-base"
            _emotion_pipeline = pipeline(
                "text-classification",
                model=model_name,
                device=-1,
                model_kwargs={"local_files_only": False}
            )
        except Exception as e:
            logger.warning(f"Could not load emotion model: {e}. Using fallback.")
            _emotion_pipeline = None
    return _emotion_pipeline


def analyze_sentiment(text: str, language: str = "en") -> float:
    """
    Analyze sentiment of text. Returns -1 (negative) to 1 (positive).
    
    Args:
        text: Text to analyze
        language: Language code
    
    Returns:
        Sentiment score from -1 to 1
    """
    pipeline = get_sentiment_pipeline()
    
    if pipeline is None:
        # Fallback: simple keyword-based sentiment
        return _fallback_sentiment(text)
    
    try:
        # Truncate if too long
        text_truncated = text[:512] if len(text) > 512 else text
        result = pipeline(text_truncated)
        
        # Handle different model outputs
        if isinstance(result, list) and len(result) > 0:
            result = result[0]
        
        label = result.get("label", "").lower()
        score = result.get("score", 0.5)
        
        # Map to -1..1 range
        if "positive" in label or "5" in label or "4" in label:
            return score
        elif "negative" in label or "1" in label or "2" in label:
            return -score
        else:
            return 0.0
    except Exception as e:
        logger.warning(f"Sentiment analysis failed: {e}. Using fallback.")
        return _fallback_sentiment(text)


def analyze_emotion(text: str, language: str = "en") -> str:
    """
    Classify emotion of text.
    
    Returns:
        Emotion label: "happy", "sad", "angry", "chill", "hopeful", "neutral", etc.
    """
    pipeline = get_emotion_pipeline()
    
    if pipeline is None:
        # Fallback: simple emotion detection
        return _fallback_emotion(text)
    
    try:
        text_truncated = text[:512] if len(text) > 512 else text
        result = pipeline(text_truncated)
        
        if isinstance(result, list) and len(result) > 0:
            result = result[0]
        
        label = result.get("label", "neutral").lower()
        
        # Map to our emotion categories
        emotion_map = {
            "joy": "happy",
            "happiness": "happy",
            "sadness": "sad",
            "anger": "angry",
            "fear": "chill",  # Fear -> chill/calm
            "surprise": "hopeful",
            "disgust": "angry",
            "neutral": "chill"
        }
        
        return emotion_map.get(label, "chill")
    except Exception as e:
        logger.warning(f"Emotion analysis failed: {e}. Using fallback.")
        return _fallback_emotion(text)


def compute_intensity(text: str, sentiment: float) -> float:
    """
    Compute intensity (0..1) based on text and sentiment.
    
    Args:
        text: Lyric text
        sentiment: Sentiment score (-1..1)
    
    Returns:
        Intensity from 0 to 1
    """
    # Base intensity from text length and sentiment magnitude
    length_factor = min(len(text) / 50.0, 1.0)
    sentiment_magnitude = abs(sentiment)
    
    # Combine factors
    intensity = 0.3 * length_factor + 0.7 * sentiment_magnitude
    
    # Check for intensity keywords
    intensity_words = ["!", "!!", "!!!", "fire", "burn", "explode", "crash", "bang"]
    if any(word in text.lower() for word in intensity_words):
        intensity = min(intensity + 0.3, 1.0)
    
    return float(np.clip(intensity, 0.0, 1.0))


def analyze_lyrics(segments: List[Dict]) -> List[Dict]:
    """
    Analyze lyrics segments for sentiment, emotion, and intensity.
    
    Args:
        segments: List of {start, end, text, language}
    
    Returns:
        List of analyzed segments with sentiment, emotion, intensity
    """
    analyzed = []
    
    for seg in segments:
        text = seg.get("text", "")
        language = seg.get("language", "en")
        
        if not text or len(text.strip()) == 0:
            continue
        
        sentiment = analyze_sentiment(text, language)
        emotion = analyze_emotion(text, language)
        intensity = compute_intensity(text, sentiment)
        
        analyzed.append({
            "start": seg["start"],
            "end": seg["end"],
            "text": text,
            "language": language,
            "sentiment": float(sentiment),
            "emotion": emotion,
            "intensity": float(intensity),
            "translated_text": None  # Translation can be added later if needed
        })
    
    return analyzed


def compute_emotion_summary(analyzed_segments: List[Dict]) -> Dict:
    """
    Compute overall emotion summary from analyzed segments.
    
    Returns:
        Dict with overall_sentiment, overall_emotion, arousal, valence
    """
    if not analyzed_segments:
        return {
            "overall_sentiment": 0.0,
            "overall_emotion": "neutral",
            "arousal": 0.5,
            "valence": 0.0
        }
    
    sentiments = [s["sentiment"] for s in analyzed_segments]
    emotions = [s["emotion"] for s in analyzed_segments]
    intensities = [s["intensity"] for s in analyzed_segments]
    
    # Overall sentiment (average)
    overall_sentiment = float(np.mean(sentiments))
    
    # Most common emotion
    from collections import Counter
    emotion_counts = Counter(emotions)
    overall_emotion = emotion_counts.most_common(1)[0][0] if emotion_counts else "neutral"
    
    # Arousal (average intensity)
    arousal = float(np.mean(intensities))
    
    # Valence (sentiment mapped to -1..1)
    valence = overall_sentiment
    
    return {
        "overall_sentiment": overall_sentiment,
        "overall_emotion": overall_emotion,
        "arousal": arousal,
        "valence": valence
    }


def _fallback_sentiment(text: str) -> float:
    """Fallback sentiment analysis using keywords."""
    positive_words = ['love', 'happy', 'joy', 'great', 'wonderful', 'beautiful', 'amazing', 'good', 'yes', 
                      'खुश', 'प्यार', 'अच्छा', 'शानदार']
    negative_words = ['hate', 'sad', 'pain', 'bad', 'terrible', 'awful', 'no', 'never', 'cry',
                      'दुख', 'नफरत', 'बुरा', 'क्रोध']
    
    text_lower = text.lower()
    positive_count = sum(1 for word in positive_words if word in text_lower)
    negative_count = sum(1 for word in negative_words if word in text_lower)
    
    if positive_count + negative_count == 0:
        return 0.0
    
    sentiment = (positive_count - negative_count) / (positive_count + negative_count)
    return max(-1.0, min(1.0, sentiment))


def _fallback_emotion(text: str) -> str:
    """Fallback emotion detection using keywords."""
    text_lower = text.lower()
    
    if any(word in text_lower for word in ['happy', 'joy', 'smile', 'laugh', 'खुश']):
        return "happy"
    elif any(word in text_lower for word in ['sad', 'cry', 'tear', 'lonely', 'दुख']):
        return "sad"
    elif any(word in text_lower for word in ['angry', 'rage', 'fury', 'mad', 'क्रोध']):
        return "angry"
    elif any(word in text_lower for word in ['hope', 'dream', 'future', 'आशा']):
        return "hopeful"
    else:
        return "chill"

