/**
 * Enhanced TTS Service for JARVIS
 * Adds natural speech patterns, emotional tone, and fluid delivery
 */

export interface EnhancedTTSConfig {
  // Basic voice settings
  rate: number;           // Speech rate (0.5-2.0, default 1.0)
  pitch: number;          // Pitch (0.5-2.0, default 1.0)
  volume: number;         // Volume (0.0-1.0, default 1.0)

  // Prosody enhancements
  intonationVariation: number;  // How much pitch varies (0.0-1.0, default 0.3)
  stressLevel: number;          // Emphasis on important words (0.0-1.0, default 0.4)
  rhythmVariation: number;      // Natural timing variations (0.0-1.0, default 0.2)

  // Emotional tone settings
  baseTone: 'neutral' | 'friendly' | 'professional' | 'enthusiastic' | 'calm';
  emotionalRange: number;       // How much emotion to inject (0.0-1.0, default 0.5)

  // Natural speech enhancements
  pauseDuration: 'short' | 'medium' | 'long';  // Default pause lengths
  emphasisStyle: 'subtle' | 'moderate' | 'strong';  // How emphasis is applied

  // SSML support setting
  ssmlSupported: boolean;       // Whether the TTS engine supports SSML (default false for most engines)
}

export interface EmotionalMarker {
  text: string;
  emotion: 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' | 'neutral' | 'curiosity' | 'confidence';
  intensity: number; // 0.0-1.0
  startIndex: number;
}

const DEFAULT_ENHANCED_CONFIG: EnhancedTTSConfig = {
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  intonationVariation: 0.3,
  stressLevel: 0.4,
  rhythmVariation: 0.2,
  baseTone: 'professional',
  emotionalRange: 0.5,
  pauseDuration: 'medium',
  emphasisStyle: 'moderate',
  ssmlSupported: false  // Most TTS engines don't support SSML properly
};

class EnhancedTTSService {
  private config: EnhancedTTSConfig;
  private emotionalMarkers: EmotionalMarker[] = [];

  constructor(config?: Partial<EnhancedTTSConfig>) {
    this.config = { ...DEFAULT_ENHANCED_CONFIG, ...config };
  }

  public updateConfig(config: Partial<EnhancedTTSConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): EnhancedTTSConfig {
    return { ...this.config };
  }

  /**
   * Preprocess text to add natural speech enhancements
   */
  public preprocessText(text: string): string {
    // Clean the text first to remove markdown symbols and convert units
    let cleanedText = this.cleanTextForSpeech(text);

    // Apply emotional markers based on text content
    this.analyzeAndMarkEmotions(cleanedText);

    // Add natural pauses and emphasis
    let processedText = this.addNaturalPauses(cleanedText);
    processedText = this.addEmphasis(processedText);

    return processedText;
  }

  /**
   * Clean text for speech by removing markdown symbols and converting units
   */
  private cleanTextForSpeech(text: string): string {
    let cleaned = text;

    // Remove markdown symbols that shouldn't be read aloud
    cleaned = cleaned.replace(/\*\*/g, ''); // Bold markers
    cleaned = cleaned.replace(/\*/g, ''); // Italic markers
    cleaned = cleaned.replace(/__/g, ''); // Underline markers
    cleaned = cleaned.replace(/#/g, ''); // Headers
    cleaned = cleaned.replace(/-\s+/g, ''); // List markers followed by spaces
    cleaned = cleaned.replace(/\[(.*?)\]\(.*?\)/g, '$1'); // Links [text](url) -> text
    cleaned = cleaned.replace(/\*\s+/g, ''); // List bullets followed by spaces
    cleaned = cleaned.replace(/(?<=^|\s)\d+\.\s+/g, ''); // Numbered list numbers after whitespace or at start of string
    cleaned = cleaned.replace(/\*\s*(?=\w)/g, ''); // Asterisks before words
    cleaned = cleaned.replace(/(?<!\w):\s/g, ''); // Colons followed by space, but not when part of time (e.g., 10:30)

    // Clean up extra spaces created during replacements
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // Convert metric units to imperial units - ALWAYS convert for imperial-only requirement
    // Use word boundaries to prevent matching decimals in phrases like "2.1 mph"
    // Process in order: temperature, length, distance, weight, volume
    
    // Temperature: Celsius to Fahrenheit
    cleaned = cleaned.replace(/\b(-?\d+(?:\.\d+)?)\s*°?C\b/g, (match, temp) => {
      const celsius = parseFloat(temp);
      const fahrenheit = (celsius * 9/5) + 32;
      return `${fahrenheit.toFixed(1)} degrees Fahrenheit`;
    });

    // Length: meters to feet/inches - Skip if already contains feet/inches
    if (!cleaned.includes('feet') && !cleaned.includes('inches')) {
      cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*m(?:eters?)?\b/g, (match, meters) => {
        const meterValue = parseFloat(meters);
        const feet = meterValue * 3.281;
        const feetWhole = Math.floor(feet);
        const inches = (feet - feetWhole) * 12;
        return `${feetWhole} feet ${Math.round(inches)} inches`;
      });
    }

    // Distance: kilometers to miles - Skip if already contains miles
    if (!cleaned.includes('miles')) {
      cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*km\b/g, (match, km) => {
        const kmValue = parseFloat(km);
        const miles = kmValue * 0.621371;
        return `${miles.toFixed(1)} miles`;
      });
    }

    // Weight: kilograms to pounds - Skip if already contains pounds
    if (!cleaned.includes('pounds')) {
      cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*kg\b/g, (match, kg) => {
        const kgValue = parseFloat(kg);
        const pounds = kgValue * 2.205;
        return `${Math.round(pounds)} pounds`;
      });
    }

    // Volume: liters to quarts - Skip if already contains quarts/gallons
    if (!cleaned.includes('quarts') && !cleaned.includes('gallon')) {
      cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*L\b/g, (match, liters) => {
        const literValue = parseFloat(liters);
        const quarts = literValue * 1.057;
        return `${quarts.toFixed(1)} quarts`;
      });
    }

    // Convert centimeters to inches - Skip if already contains inches
    if (!cleaned.includes('inches')) {
      cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*cm\b/g, (match, cm) => {
        const cmValue = parseFloat(cm);
        const inches = cmValue * 0.3937;
        return `${inches.toFixed(1)} inches`;
      });
    }

    // Convert millimeters to inches - Skip if already contains inches
    if (!cleaned.includes('inches')) {
      cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)\s*mm\b/g, (match, mm) => {
        const mmValue = parseFloat(mm);
        const inches = mmValue * 0.03937;
        return `${inches.toFixed(2)} inches`;
      });
    }

    // Clean up extra spaces created during replacements
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }

  /**
   * Analyze text and mark emotional content
   */
  private analyzeAndMarkEmotions(text: string): void {
    this.emotionalMarkers = [];
    const sentences = text.split(/(?<=[.!?])\s+/);

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const startIndex = text.indexOf(sentence);

      // Detect emotional content
      if (this.containsJoyIndicators(sentence)) {
        this.emotionalMarkers.push({
          text: sentence,
          emotion: 'joy',
          intensity: this.calculateEmotionIntensity(sentence, 'joy'),
          startIndex
        });
      } else if (this.containsCuriosityIndicators(sentence)) {
        this.emotionalMarkers.push({
          text: sentence,
          emotion: 'curiosity',
          intensity: this.calculateEmotionIntensity(sentence, 'curiosity'),
          startIndex
        });
      } else if (this.containsConfidenceIndicators(sentence)) {
        this.emotionalMarkers.push({
          text: sentence,
          emotion: 'confidence',
          intensity: this.calculateEmotionIntensity(sentence, 'confidence'),
          startIndex
        });
      }
      // Add more emotion detections as needed
    }
  }

  private containsJoyIndicators(text: string): boolean {
    const joyWords = [
      'great', 'excellent', 'wonderful', 'fantastic', 'awesome', 'perfect',
      'amazing', 'incredible', 'brilliant', 'delighted', 'pleased', 'happy',
      'excited', 'thrilled', 'glad', 'love', 'enjoy', 'fun', 'positive'
    ];
    return joyWords.some(word => text.toLowerCase().includes(word));
  }

  private containsCuriosityIndicators(text: string): boolean {
    const curiosityWords = [
      'interesting', 'fascinating', 'intriguing', 'notable', 'remarkable',
      'unusual', 'peculiar', 'curious', 'question', 'wonder', 'investigate',
      'explore', 'discover', 'analyze', 'examine', 'study'
    ];
    return curiosityWords.some(word => text.toLowerCase().includes(word));
  }

  private containsConfidenceIndicators(text: string): boolean {
    const confidenceWords = [
      'certain', 'definitely', 'absolutely', 'clearly', 'obviously', 'indeed',
      'certainly', 'undoubtedly', 'without doubt', 'confident', 'sure',
      'reliable', 'proven', 'established', 'verified', 'confirmed'
    ];
    return confidenceWords.some(word => text.toLowerCase().includes(word));
  }

  private calculateEmotionIntensity(text: string, emotion: string): number {
    // Calculate intensity based on word frequency and context
    let intensity = 0.3; // Base intensity

    // Boost for exclamation marks
    intensity += (text.match(/!/g) || []).length * 0.2;

    // Boost for emphasis words
    const emphasisWords = ['very', 'extremely', 'incredibly', 'highly', 'really', 'quite', 'absolutely'];
    for (const word of emphasisWords) {
      if (text.toLowerCase().includes(word)) {
        intensity += 0.1;
      }
    }

    return Math.min(1.0, intensity);
  }

  /**
   * Add natural pauses to text
   */
  private addNaturalPauses(text: string): string {
    // First, protect decimal numbers by temporarily replacing them with a placeholder
    const decimalPlaceholder = '__DECIMAL_NUMBER__';
    let result = text.replace(/\d+\.\d+/g, (match) => {
      return match.replace('.', decimalPlaceholder);
    });

    // Add pauses after commas, semicolons, and conjunctions
    result = result
      // Add short pause after commas
      .replace(/,(?!\s)/g, ', ')  // Only add space after comma if not already present
      // Add medium pause after periods, question marks, exclamation marks
      .replace(/[.!?]/g, (match) => match + ' ')
      // Add pause after common conjunctions
      .replace(/\b(and|but|or|so|yet|for|nor)\b/g, '$1 ');

    // Restore decimal numbers
    result = result.replace(new RegExp(decimalPlaceholder, 'g'), '.');

    return result;
  }

  /**
   * Add emphasis to important words
   */
  private addEmphasis(text: string): string {
    // Define emphasis patterns
    const emphasisPatterns = [
      { pattern: /\b(important|critical|essential|crucial|vital|key|main|primary)\b/gi, strength: 'strong' },
      { pattern: /\b(notable|significant|remarkable|exceptional|outstanding)\b/gi, strength: 'moderate' },
      { pattern: /\b(interesting|fascinating|amazing|incredible|wonderful)\b/gi, strength: 'moderate' },
      { pattern: /\b(please|thank you|sorry|excuse me)\b/gi, strength: 'subtle' },
      { pattern: /\b(caution|warning|careful|attention|alert)\b/gi, strength: 'strong' }
    ];

    let result = text;

    // Only add emphasis tags if SSML is supported
    if (this.config.ssmlSupported) {
      for (const { pattern, strength } of emphasisPatterns) {
        result = result.replace(pattern, (match) => {
          // Wrap emphasized words with subtle markup that can be interpreted by TTS
          return `<emphasis level="${strength}">${match}</emphasis>`;
        });
      }
    }

    return result;
  }

  /**
   * Apply prosody modifications for natural speech
   */
  public applyProsody(text: string): string {
    // Only apply prosody if SSML is supported
    if (!this.config.ssmlSupported) {
      return text;
    }

    // Apply intonation variations based on sentence type
    let result = text;

    // Add intonation patterns for questions
    result = result.replace(/([^.!?]+)\?/g, (match, sentence) => {
      return `<prosody pitch="+5%" range="+10%">${sentence}?</prosody>`;
    });

    // Add intonation for exclamations
    result = result.replace(/([^.!?]+)!/g, (match, sentence) => {
      return `<prosody pitch="+10%" range="+20%" rate="+10%">${sentence}!</prosody>`;
    });

    // Apply emotional tone modifications
    result = this.applyEmotionalTones(result);

    return result;
  }

  private applyEmotionalTones(text: string): string {
    // Only apply emotional tones if SSML is supported
    if (!this.config.ssmlSupported) {
      return text;
    }

    let result = text;

    // Apply different tones based on detected emotions
    for (const marker of this.emotionalMarkers) {
      let toneAdjustment = '';

      switch (marker.emotion) {
        case 'joy':
          toneAdjustment = `<prosody pitch="+5%" range="+15%" rate="+5%">${marker.text}</prosody>`;
          break;
        case 'curiosity':
          toneAdjustment = `<prosody pitch="+3%" contour="(0%,+10Hz) (25%,+5Hz) (50%,+15Hz) (75%,+5Hz) (100%,-5Hz)">${marker.text}</prosody>`;
          break;
        case 'confidence':
          toneAdjustment = `<prosody pitch="-2%" range="-5%" rate="-5%">${marker.text}</prosody>`;
          break;
        case 'neutral':
        default:
          toneAdjustment = marker.text;
          break;
      }

      // Only replace if the tone adjustment is different
      if (toneAdjustment !== marker.text) {
        result = result.replace(marker.text, toneAdjustment);
      }
    }

    return result;
  }

  /**
   * Generate enhanced speech parameters based on configuration
   */
  public generateSpeechParameters(): any {
    const params = {
      rate: this.config.rate,
      pitch: this.config.pitch,
      volume: this.config.volume,
      // Additional parameters for natural speech
      intonation: this.config.intonationVariation,
      stress: this.config.stressLevel,
      rhythm: this.config.rhythmVariation,
      emotionalRange: this.config.emotionalRange,
      baseTone: this.config.baseTone
    };

    return params;
  }

  /**
   * Enhance text for more natural delivery
   */
  public enhanceTextForNaturalSpeech(text: string): string {
    // Preprocess the text
    let enhancedText = this.preprocessText(text);

    // Apply prosody modifications
    enhancedText = this.applyProsody(enhancedText);

    // Apply base tone characteristics
    enhancedText = this.applyBaseTone(enhancedText);

    return enhancedText;
  }

  private applyBaseTone(text: string): string {
    // Only apply base tone if SSML is supported
    if (!this.config.ssmlSupported) {
      return text;
    }

    switch (this.config.baseTone) {
      case 'friendly':
        // Add warmth to the voice
        return `<prosody pitch="+2%" range="+5%">${text}</prosody>`;
      case 'professional':
        // Maintain steady, clear delivery
        return `<prosody pitch="+0%" range="+0%" rate="-5%">${text}</prosody>`;
      case 'enthusiastic':
        // More energy and variation
        return `<prosody pitch="+5%" range="+15%" rate="+5%">${text}</prosody>`;
      case 'calm':
        // Softer, slower delivery
        return `<prosody pitch="-3%" range="-10%" rate="-10%">${text}</prosody>`;
      default:
        return text;
    }
  }

  /**
   * Smooth transitions between speech segments
   */
  public smoothTransitions(text: string): string {
    // Only add transitions if SSML is supported
    if (!this.config.ssmlSupported) {
      return text;
    }

    // Add subtle breathing sounds or pauses between major segments
    // This would typically be handled by the underlying TTS engine
    // For now, we'll add natural pause markers

    // Split on sentence boundaries and add slight variations
    const sentences = text.split(/(?<=[.!?])\s+/);
    return sentences
      .map((sentence, index) => {
        // Add slight timing variation between sentences
        const pauseVariation = 1 + (Math.random() * 0.2 - 0.1); // ±10%
        return `${sentence}<break time="${pauseVariation}s"/>`;
      })
      .join('');
  }

  /**
   * Clean SSML tags from text if needed
   */
  public cleanSSML(text: string): string {
    // Remove SSML tags that might be read literally by TTS engines
    return text
      .replace(/<prosody\s+[^>]*>/gi, '')
      .replace(/<\/prosody>/gi, '')
      .replace(/<emphasis\s+[^>]*>/gi, '')
      .replace(/<\/emphasis>/gi, '')
      .replace(/<break\s+[^>]*>/gi, ' ')
      .replace(/<speak>/gi, '')
      .replace(/<\/speak>/gi, '')
      .replace(/<say-as\s+[^>]*>/gi, '')
      .replace(/<\/say-as>/gi, '')
      .replace(/<sub\s+[^>]*>/gi, '')
      .replace(/<\/sub>/gi, '')
      .replace(/<phoneme\s+[^>]*>/gi, '')
      .replace(/<\/phoneme>/gi, '')
      .replace(/\s+/g, ' ')  // Clean up extra spaces
      .trim();
  }
}

// Singleton instance
export const enhancedTTS = new EnhancedTTSService();

// Export for use in voice service
export default enhancedTTS;