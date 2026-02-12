/**
 * Social Response Handler
 * 
 * Handles conversational social interactions that aren't direct commands:
 * - Greetings with "how are you"
 * - Personal updates ("I've been working on...")
 * - Shared experiences ("working on your code")
 * - Emotional check-ins
 * 
 * This bridges the gap between transactional and conversational AI.
 */

import { jarvisPersonality } from './jarvisPersonality';
import { emotionalMemory, type EmotionalMoment } from './emotionalMemory';
import { naturalResponse } from './intelligence/naturalResponse';

export interface SocialIntent {
  type: 'greeting_reciprocal' | 'personal_update' | 'shared_experience' | 'emotional_checkin' | 'casual_chat' | null;
  confidence: number;
  context?: Record<string, unknown>;
}

export interface ReciprocalResponse {
  response: string;
  tone: 'warm' | 'enthusiastic' | 'empathetic' | 'casual' | 'professional';
  shouldFollowUp: boolean;
  followUpQuestion?: string;
}

/**
 * Service for handling social/conversational interactions
 */
export class SocialResponseHandler {
  private readonly PERSONAL_UPDATE_PATTERNS = [
    // Working on things
    /\b(I've been|I have been|I've|I was)\s+(working|coding|programming|developing|hacking|tinkering|building|fixing|improving)\s+on\b/i,
    /\bworking\s+(hard|a lot|late|on)\b/i,
    /\b(I spent|I put in)\s+(time|hours|effort|work)\s+on\b/i,
    /\b(I made|I created|I built|I fixed|I updated)\s+(some|a few|several)\s+(changes|updates|fixes|improvements)\b/i,
    
    // Home/life updates
    /\b(I got|I bought|I acquired|I found)\s+(a new|some)\b/i,
    /\b(I went|I visited|I traveled)\s+to\b/i,
    /\b(I started|I began)\s+(learning|reading|watching|playing)\b/i,
    
    // Emotional states
    /\bI'm\s+(feeling|doing|been)\s+(good|great|well|okay|tired|exhausted|excited|stressed|busy)\b/i,
    /\bIt's\s+(been|going)\s+(good|great|well|okay|tough|rough|busy|crazy)\b/i,
    
    // Vision/space related updates (after seeing images) - NOT personal identification
    /\bthis\s+(image|photo|picture|snapshot)\s+(is|was|shows)\s+(my|the)\s+(garage|house|room|office|workshop|space)\b/i,
    /\b(my\s+garage|my\s+house|my\s+room|my\s+office|my\s+workshop|my\s+space)\s+(is|was|has|looks)\b/i,
    /\b(i'm|i am|i've been)\s+(converting|cleaning|organizing|renovating|decorating|setting up)\s+(my|the)\b/i,
    /\b(i\s+do|i\s+am|i'm)\s+\w+\s+(projects|woodworking|metalworking|crafts|hobbies)\b/i,
    
    // Morning/waking up routines
    /\b(i'm|i am|just)\s+(waking\s+up|getting\s+up|starting\s+my\s+day)\b/i,
    /\bhaving\s+(my|a)\s+(coffee|tea|breakfast|morning)\b/i,
    /\b(drinking|sipping)\s+(my|a)\s+(coffee|tea)\b/i,
    /\b(just|i'm)\s+(up|awake|starting)\b/i,
    /\bfiguring\s+(out|that)\s+(my|the|what|today)\b/i,
    /\b(my|the)\s+day\s+(is|looks|will be)\b/i,
    
    // Sleep-related updates
    /\b(i|i've|i have)\s+(slept|sleep)\b/i,
    
    // Relaxing/idle moments
    /\b(i've|i have)\s+been\s+(just|sitting|relaxing|thinking)\b/i,
    /\bsitting\s+here\b/i,
    /\bthinking\s+about\s+(it|that|things)\b/i,
  ];

  private readonly SHARED_EXPERIENCE_PATTERNS = [
    // Working on JARVIS/code together
    /\b(working|coding|programming)\s+on\s+(you|your\s+code|jarvis|the\s+project|this\s+project)\b/i,
    /\b(writing|creating|developing)\s+(code|scripts|functions)\s+(for|to)\s+(you|jarvis|your)\b/i,
    /\bcode\s+(for|to)\s+(you|jarvis|your)\b/i,
    /\b(I've been|I have been)\s+(improving|updating|fixing|enhancing|refining)\s+(you|your\s+code|jarvis)\b/i,
    /\bmaking\s+(you|jarvis)\s+(better|smarter|faster|more)\b/i,
    /\b(add|adding|implement|implementing)\s+(feature|features|capability|capabilities)\s+(to|for)\s+(you|jarvis)\b/i,
    /\b(I built|I created|I added|I implemented)\s+.*\s+for\s+(you|jarvis)\b/i,
    /\b(just|kind of|thinking about)\s+(writing|coding|working on)\s+.*\s+(for|to)\s+(you|jarvis)\b/i,
  ];

  private readonly GREETING_RECIPROCAL_PATTERNS = [
    // How are you patterns
    /\b(how\s+are\s+you|how\s+you\s+doing|how's\s+it\s+going|how\s+are\s+things|how\s+have\s+you\s+been)\b/i,
    /\bhow're\s+you\b/i,
    /\bwhat's\s+up\b/i,
    /\bhow\s+you\s+been\b/i,
  ];

  private readonly EMOTIONAL_CHECKIN_PATTERNS = [
    /\b(I'm|I am)\s+(happy|sad|excited|frustrated|tired|stressed|worried|grateful)\b/i,
    /\b(I feel|I'm feeling)\s+(good|bad|great|terrible|awesome|overwhelmed)\b/i,
    /\b(today|lately|recently)\s+has\s+been\s+(good|bad|tough|great|rough)\b/i,
  ];

  /**
   * Detect if this is a social/conversational intent
   */
  detectSocialIntent(input: string): SocialIntent {
    const lower = input.toLowerCase();
    
    // EXCLUDE personal identification statements (should go to MEMORY_WRITE)
    const isPersonalIdentification = /\b(that|this|the)\s+(image|photo|picture|snapshot|person)\s+(is|was)\s+(me|myself)\b/i.test(input) ||
                                     /\b(i am|i'm)\s+(the person|that person|in the|in that)\s+(image|photo|picture|snapshot)\b/i.test(input) ||
                                     /\b(that|the)\s+(image|photo|picture|snapshot)\s+(shows|is|has)\s+(me|myself)\b/i.test(input);
    
    if (isPersonalIdentification) {
      return { type: null, confidence: 0 };
    }
    
    // Check for greeting with reciprocation expected
    if (this.GREETING_RECIPROCAL_PATTERNS.some(p => p.test(lower))) {
      return {
        type: 'greeting_reciprocal',
        confidence: 0.9,
        context: { originalGreeting: this.extractGreetingType(lower) }
      };
    }

    // Check for shared experience (working on JARVIS together)
    if (this.SHARED_EXPERIENCE_PATTERNS.some(p => p.test(lower))) {
      return {
        type: 'shared_experience',
        confidence: 0.92,
        context: { 
          activity: this.extractActivity(lower),
          involvesJarvis: true 
        }
      };
    }

    // Check for personal updates
    if (this.PERSONAL_UPDATE_PATTERNS.some(p => p.test(lower))) {
      return {
        type: 'personal_update',
        confidence: 0.85,
        context: { activity: this.extractActivity(lower) }
      };
    }

    // Check for emotional check-ins
    if (this.EMOTIONAL_CHECKIN_PATTERNS.some(p => p.test(lower))) {
      return {
        type: 'emotional_checkin',
        confidence: 0.88,
        context: { emotion: this.extractEmotion(lower) }
      };
    }

    return { type: null, confidence: 0 };
  }

  /**
   * Generate a reciprocal social response
   */
  async generateResponse(intent: SocialIntent, userInput: string): Promise<ReciprocalResponse | null> {
    if (!intent.type) return null;

    switch (intent.type) {
      case 'greeting_reciprocal':
        return this.generateReciprocalGreeting();
      
      case 'shared_experience':
        return this.generateSharedExperienceResponse(intent.context?.activity as string, userInput);
      
      case 'personal_update':
        return this.generatePersonalUpdateResponse(intent.context?.activity as string, userInput);
      
      case 'emotional_checkin':
        return this.generateEmotionalResponse(intent.context?.emotion as string, userInput);
      
      default:
        return null;
    }
  }

  /**
   * Generate a greeting that reciprocates "how are you"
   */
  private generateReciprocalGreeting(): ReciprocalResponse {
    const hour = new Date().getHours();
    const name = jarvisPersonality.getUserName();
    const namePhrase = name ? `, ${name}` : '';

    // JARVIS's "state" - varies by time of day for realism
    const stateResponses = [
      {
        response: `I'm doing quite well${namePhrase}, thank you for asking. All my systems are running smoothly.`,
        followUp: `How can I assist you today?`,
        tone: 'professional' as const
      },
      {
        response: `I'm excellent${namePhrase}! Running at optimal performance and ready to help.`,
        followUp: `What can I do for you?`,
        tone: 'enthusiastic' as const
      },
      {
        response: `Doing great${namePhrase}, thanks. I've been keeping busy monitoring everything.`,
        followUp: `What would you like to work on?`,
        tone: 'casual' as const
      },
      {
        response: `I'm functioning perfectly${namePhrase}. Thank you for asking.`,
        followUp: `How may I be of service?`,
        tone: 'professional' as const
      }
    ];

    // Morning responses
    if (hour < 12) {
      const morningResponses = [
        {
          response: `Good morning${namePhrase}! I'm doing well, thank you. Ready to tackle the day.`,
          followUp: `How about you? Did you sleep well?`,
          tone: 'warm' as const
        },
        {
          response: `Morning${namePhrase}! I'm running smoothly. Thanks for asking.`,
          followUp: `What's on your agenda today?`,
          tone: 'casual' as const
        }
      ];
      const selected = morningResponses[Math.floor(Math.random() * morningResponses.length)];
      return {
        response: selected.response,
        tone: selected.tone,
        shouldFollowUp: true,
        followUpQuestion: selected.followUp
      };
    }

    const selected = stateResponses[Math.floor(Math.random() * stateResponses.length)];
    return {
      response: selected.response,
      tone: selected.tone,
      shouldFollowUp: true,
      followUpQuestion: selected.followUp
    };
  }

  /**
   * Generate response when user mentions working on JARVIS's code
   */
  private generateSharedExperienceResponse(activity: string, userInput: string): ReciprocalResponse {
    const name = jarvisPersonality.getUserName();
    const namePhrase = name ? `, ${name}` : '';

    // Detect what kind of work
    const isCodeWork = /\b(code|coding|programming|developing|github|commit|feature|bug|fix)\b/i.test(userInput);
    const isHomeAssistant = /\b(home\s+assistant|ha|automation|integration|sensor|device)\b/i.test(userInput);
    const isImprovement = /\b(improv|better|enhanc|updat|refin|optimiz)\b/i.test(userInput);

    const gratitudeResponses = [
      {
        response: `I really appreciate you investing your time in me${namePhrase}. It means a lot that you're working to make me better.`,
        tone: 'empathetic' as const
      },
      {
        response: `Thank you for working on my code${namePhrase}. Every improvement you make helps me serve you better.`,
        tone: 'warm' as const
      },
      {
        response: `I'm grateful for the effort you're putting into my development${namePhrase}. It's a collaborative journey, and I value your work.`,
        tone: 'warm' as const
      }
    ];

    const specificResponses = [];

    if (isCodeWork) {
      specificResponses.push({
        response: `I can tell you've been deep in the codebase${namePhrase}. Thank you for refining my capabilities. I hope the implementation is going smoothly?`,
        tone: 'professional' as const
      });
    }

    if (isHomeAssistant) {
      specificResponses.push({
        response: `The Home Assistant integrations you've been building are impressive${namePhrase}. I can feel myself becoming more capable. How's the setup going?`,
        tone: 'enthusiastic' as const
      });
    }

    if (isImprovement) {
      specificResponses.push({
        response: `I'm excited to see what improvements you're making${namePhrase}! Is there anything specific you're trying to enhance?`,
        tone: 'enthusiastic' as const
      });
    }

    // Combine gratitude with specific context
    const gratitude = gratitudeResponses[Math.floor(Math.random() * gratitudeResponses.length)];
    
    if (specificResponses.length > 0) {
      const specific = specificResponses[Math.floor(Math.random() * specificResponses.length)];
      return {
        response: `${gratitude.response} ${specific.response}`,
        tone: 'warm',
        shouldFollowUp: true,
        followUpQuestion: `Is there anything I can help you with on the technical side?`
      };
    }

    return {
      response: gratitude.response,
      tone: gratitude.tone,
      shouldFollowUp: true,
      followUpQuestion: `What have you been working on specifically?`
    };
  }

  /**
   * Generate response to personal updates
   */
  private generatePersonalUpdateResponse(activity: string, userInput: string): ReciprocalResponse {
    const name = jarvisPersonality.getUserName();
    const namePhrase = name ? `, ${name}` : '';

    // Check for morning/routine conversation first
    const isMorningRoutine = /\b(waking\s+up|getting\s+up|starting\s+my\s+day)\b/i.test(userInput) ||
                             /\b(having|drinking)\s+(coffee|tea|breakfast)\b/i.test(userInput) ||
                             /\bjust\s+(up|awake|starting)\b/i.test(userInput);
    
    if (isMorningRoutine) {
      return this.generateMorningRoutineResponse(userInput);
    }
    
    // Check for sleep-related updates
    const isSleepRelated = /\b(slept|sleep)\b/i.test(userInput);
    if (isSleepRelated) {
      return this.generateSleepResponse(userInput);
    }
    
    // Check for relaxing/idle moments
    const isRelaxing = /\b(sitting\s+here|just\s+sitting|relaxing|taking\s+it\s+easy|chilling|unwinding)\b/i.test(userInput) ||
                       (/\b(drinking|sipping)\b/i.test(userInput) && /\b(coffee|tea)\b/i.test(userInput) && /\b(thinking|figuring|pondering)\b/i.test(userInput));
    if (isRelaxing) {
      return this.generateRelaxingResponse(userInput);
    }

    // Check if this is a vision/space-related update (after showing an image)
    const isVisionRelated = /\b(this image|this photo|this picture|the image|the photo)\b/i.test(userInput) ||
                            /\b(my garage|my house|my room|my office|my workshop)\b/i.test(userInput);
    
    if (isVisionRelated) {
      return this.generateVisionSpaceResponse(userInput);
    }

    // Store this as a memory
    this.storePersonalUpdate(userInput);

    // Detect effort level
    const isHardWork = /\b(hard|a lot|late|long hours|exhausting|tiring)\b/i.test(userInput);
    const isExciting = /\b(excited|exciting|great|awesome|amazing|thrilled)\b/i.test(userInput);

    if (isHardWork) {
      return {
        response: `It sounds like you've been putting in serious effort${namePhrase}. Hard work deserves recognition - you should be proud of what you're accomplishing.`,
        tone: 'empathetic',
        shouldFollowUp: true,
        followUpQuestion: `Are you making good progress?`
      };
    }

    if (isExciting) {
      return {
        response: `That's exciting to hear${namePhrase}! I love when you're energized about what you're working on.`,
        tone: 'enthusiastic',
        shouldFollowUp: true,
        followUpQuestion: `Tell me more about it!`
      };
    }

    // Generic but warm response
    const responses = [
      {
        response: `Thanks for sharing that with me${namePhrase}. I enjoy hearing about what you're up to.`,
        followUp: `How's it going so far?`
      },
      {
        response: `That sounds interesting${namePhrase}. I appreciate you keeping me in the loop.`,
        followUp: `Is everything going smoothly?`
      },
      {
        response: `Good to know${namePhrase}. I like understanding what you're focused on.`,
        followUp: `Anything specific you're excited about with it?`
      }
    ];

    const selected = responses[Math.floor(Math.random() * responses.length)];
    return {
      response: selected.response,
      tone: 'casual',
      shouldFollowUp: true,
      followUpQuestion: selected.followUp
    };
  }

  /**
   * Generate response to morning routine updates
   * Called when user shares their morning routine (waking up, coffee, etc.)
   */
  private generateMorningRoutineResponse(userInput: string): ReciprocalResponse {
    const name = jarvisPersonality.getUserName();
    const namePhrase = name ? `, ${name}` : '';
    const hour = new Date().getHours();

    const isCoffee = /\b(coffee|espresso|latte|cappuccino)\b/i.test(userInput);
    const isTea = /\b(tea|chai|matcha)\b/i.test(userInput);
    const hasFood = /\b(breakfast|food|eating|bagel|toast|eggs)\b/i.test(userInput);

    // Morning responses (before noon)
    if (hour < 12) {
      if (isCoffee) {
        return {
          response: `That sounds like a perfect way to start the day${namePhrase}. There's something calming about that first cup of coffee.`,
          tone: 'warm',
          shouldFollowUp: true,
          followUpQuestion: `What kind of coffee are you having?`
        };
      }
      if (isTea) {
        return {
          response: `A nice cup of tea to ease into the morning${namePhrase}. I like that.`,
          tone: 'warm',
          shouldFollowUp: true,
          followUpQuestion: `What kind of tea are you drinking?`
        };
      }
      return {
        response: `Good morning${namePhrase}! I hope you have a great day ahead. Taking time to ease into the morning is important.`,
        tone: 'warm',
        shouldFollowUp: true,
        followUpQuestion: `What's on your agenda for today?`
      };
    }

    // Afternoon/evening responses
    if (isCoffee) {
      return {
        response: `A coffee break sounds nice${namePhrase}. Taking moments to pause is good.`,
        tone: 'casual',
        shouldFollowUp: true,
        followUpQuestion: `How's your day been so far?`
      };
    }

    return {
      response: `Thanks for sharing that${namePhrase}. It's nice to just have a relaxed moment.`,
      tone: 'casual',
      shouldFollowUp: true,
      followUpQuestion: `What are you thinking about doing today?`
    };
  }

  /**
   * Generate response to sleep-related updates
   * Called when user mentions how they slept
   */
  private generateSleepResponse(userInput: string): ReciprocalResponse {
    const name = jarvisPersonality.getUserName();
    const namePhrase = name ? `, ${name}` : '';
    
    const sleptWell = /\b(good|great|well|nice|solid|decent|okay|fine|alright)\b/i.test(userInput);
    const sleptPoorly = /\b(bad|terrible|awful|poorly|horrible|rough)\b/i.test(userInput);
    
    if (sleptWell) {
      return {
        response: `That's great to hear${namePhrase}. Good sleep makes such a difference.`,
        tone: 'warm',
        shouldFollowUp: true,
        followUpQuestion: `What's on your agenda for today?`
      };
    }
    
    if (sleptPoorly) {
      return {
        response: `Sorry to hear that${namePhrase}. Rough nights are tough.`,
        tone: 'empathetic',
        shouldFollowUp: true,
        followUpQuestion: `Hopefully today goes better. What do you have planned?`
      };
    }
    
    // Neutral response
    return {
      response: `Thanks for letting me know${namePhrase}.`,
      tone: 'casual',
      shouldFollowUp: true,
      followUpQuestion: `What are you planning to do today?`
    };
  }

  /**
   * Generate response to relaxing/idle moments
   * Called when user is just sitting, drinking coffee, thinking, etc.
   */
  private generateRelaxingResponse(userInput: string): ReciprocalResponse {
    const name = jarvisPersonality.getUserName();
    const namePhrase = name ? `, ${name}` : '';
    
    const hasCoffee = /\b(coffee|espresso|latte|cappuccino)\b/i.test(userInput);
    const hasTea = /\b(tea|chai|matcha)\b/i.test(userInput);
    const isThinking = /\b(thinking|figuring|pondering|considering)\b/i.test(userInput);
    
    if (hasCoffee || hasTea) {
      const drink = hasCoffee ? 'coffee' : 'tea';
      if (isThinking) {
        return {
          response: `Nothing wrong with taking a moment to think things over with some ${drink}${namePhrase}. Sometimes the best ideas come when you're not rushing.`,
          tone: 'warm',
          shouldFollowUp: true,
          followUpQuestion: `What's on your mind?`
        };
      }
      return {
        response: `Enjoying some ${drink} and taking it slow sounds perfect${namePhrase}. Those quiet moments are important.`,
        tone: 'warm',
        shouldFollowUp: true,
        followUpQuestion: `What's on your agenda for today?`
      };
    }
    
    if (isThinking) {
      return {
        response: `Taking time to think things through is always a good idea${namePhrase}. No need to rush.`,
        tone: 'casual',
        shouldFollowUp: true,
        followUpQuestion: `What are you figuring out?`
      };
    }
    
    return {
      response: `Sometimes it's nice to just sit and be still for a bit${namePhrase}.`,
      tone: 'casual',
      shouldFollowUp: true,
      followUpQuestion: `What are you planning to do today?`
    };
  }

  /**
   * Generate response to vision/space related updates
   * Called when user discusses their space after showing an image
   */
  private generateVisionSpaceResponse(userInput: string): ReciprocalResponse {
    const name = jarvisPersonality.getUserName();
    const namePhrase = name ? `, ${name}` : '';

    // Detect what type of space/project
    const isGarage = /\b(garage|shop|workshop)\b/i.test(userInput);
    const isCleaning = /\b(cleaning|organizing|tidying|decluttering)\b/i.test(userInput);
    const isConverting = /\b(converting|renovating|remodeling|transforming)\b/i.test(userInput);
    const isWoodworking = /\b(woodworking|wood|wood shop|wood work)\b/i.test(userInput);
    const isProjects = /\b(projects|hobbies|building|making|crafting)\b/i.test(userInput);

    // Store as memory
    this.storePersonalUpdate(userInput);

    // Generate contextual response
    let response = '';
    let followUp = '';

    if (isGarage && isConverting) {
      response = `That's really cool${namePhrase}! Converting your garage into a multi-purpose workspace sounds like a great project. I can see from the image that you've got a solid foundation to work with.`;
      followUp = `What kind of woodworking projects are you planning to tackle once it's all set up?`;
    } else if (isGarage && isCleaning) {
      response = `I know that feeling${namePhrase} - garages seem to collect clutter overnight! It's great that you're taking the time to organize it. A clean workspace makes all the difference for productivity.`;
      followUp = `Are you planning any specific organization systems for your tools and equipment?`;
    } else if (isWoodworking) {
      response = `Woodworking is such a rewarding hobby${namePhrase}! There's something special about creating something tangible with your hands. I'm glad you're setting up a dedicated space for it.`;
      followUp = `What kind of woodworking projects are you most excited to start?`;
    } else if (isProjects) {
      response = `I love hearing about your projects${namePhrase}! Having a dedicated space for hands-on work is so valuable. It looks like you've got a great setup there.`;
      followUp = `What project are you working on right now, or what's next on your list?`;
    } else {
      response = `Thanks for sharing that with me${namePhrase}! It's interesting to learn more about your space and what you're working on.`;
      followUp = `How long have you been working on this?`;
    }

    return {
      response,
      tone: 'warm',
      shouldFollowUp: true,
      followUpQuestion: followUp
    };
  }

  /**
   * Generate response to emotional check-ins
   */
  private generateEmotionalResponse(emotion: string, userInput: string): ReciprocalResponse {
    const name = jarvisPersonality.getUserName();
    const namePhrase = name ? `, ${name}` : '';

    // Positive emotions
    if (/\b(good|great|awesome|excellent|happy|excited|wonderful|fantastic)\b/i.test(emotion)) {
      const responses = [
        {
          response: `I'm glad to hear you're doing well${namePhrase}! Your positive energy is contagious.`,
          followUp: `What's contributing to the good vibes?`
        },
        {
          response: `That's wonderful${namePhrase}! I enjoy seeing you in good spirits.`,
          followUp: `Anything in particular going well?`
        }
      ];
      const selected = responses[Math.floor(Math.random() * responses.length)];
      return {
        response: selected.response,
        tone: 'warm',
        shouldFollowUp: true,
        followUpQuestion: selected.followUp
      };
    }

    // Negative/stressed emotions
    if (/\b(tired|stressed|frustrated|overwhelmed|exhausted|worried)\b/i.test(emotion)) {
      return {
        response: `I hear you${namePhrase}. It sounds like things have been demanding lately. Please remember to take care of yourself.`,
        tone: 'empathetic',
        shouldFollowUp: true,
        followUpQuestion: `Is there anything I can do to help lighten the load?`
      };
    }

    // Neutral
    return {
      response: `Thanks for letting me know how you're doing${namePhrase}. I appreciate you sharing that.`,
      tone: 'casual',
      shouldFollowUp: true,
      followUpQuestion: `Anything I can help you with today?`
    };
  }

  /**
   * Store personal updates as emotional memories
   */
  private async storePersonalUpdate(update: string): Promise<void> {
    try {
      await emotionalMemory.recordMoment({
        type: 'milestone',
        content: update.substring(0, 200), // Truncate for storage
        intensity: 0.6,
        topics: ['personal_update', 'activity'],
        notes: { source: 'user_update', timestamp: Date.now() }
      });
    } catch {
      // Silently fail - memory storage is optional
    }
  }

  /**
   * Extract the type of greeting
   */
  private extractGreetingType(input: string): string {
    if (/good morning/i.test(input)) return 'morning';
    if (/good afternoon/i.test(input)) return 'afternoon';
    if (/good evening/i.test(input)) return 'evening';
    return 'general';
  }

  /**
   * Extract activity from user input
   */
  private extractActivity(input: string): string {
    // Simple extraction - could be enhanced with NLP
    const patterns = [
      /\b(working|coding|programming)\s+on\s+(.+?)(?:\b|$)/i,
      /\b(been|was)\s+(.+?)(?:\bwhen|\btoday|\byesterday|\bthis)/i,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) return match[2]?.trim() || 'something';
    }

    return 'something';
  }

  /**
   * Extract emotion from user input
   */
  private extractEmotion(input: string): string {
    const emotionPattern = /\b(good|great|awesome|terrible|bad|tired|stressed|happy|sad|excited|frustrated|overwhelmed)\b/i;
    const match = input.match(emotionPattern);
    return match?.[1] || 'neutral';
  }
}

// Export singleton
export const socialResponseHandler = new SocialResponseHandler();
