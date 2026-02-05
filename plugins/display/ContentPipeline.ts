import { ContentRequest, RenderResult } from './types';
import { FormatDetector } from './utils/FormatDetector';
import { ContentValidator } from './utils/ContentValidator';
import { ModelSelector } from './utils/ModelSelector';
import { NotificationService } from './utils/NotificationService';

export class ContentPipeline {
  private validator: ContentValidator;
  private detector: FormatDetector;
  private modelSelector: ModelSelector;
  private notifier: NotificationService;
  
  constructor(
    validator: ContentValidator,
    detector: FormatDetector,
    modelSelector: ModelSelector,
    notifier: NotificationService
  ) {
    this.validator = validator;
    this.detector = detector;
    this.modelSelector = modelSelector;
    this.notifier = notifier;
  }
  
  async process(content: ContentRequest): Promise<{ 
    processedContent: ContentRequest; 
    selectedModel: string; 
    warnings: string[]; 
  }> {
    // Validate content
    const validation = this.validator.validate(content);
    if (!validation.isValid) {
      throw new Error(`Content validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Detect content type if not specified
    let contentType = content.type;
    if (contentType === 'text' && content.description) {
      contentType = this.detector.detectContentType(content.description);
    }
    
    // Select appropriate model
    const modelSelection = this.modelSelector.selectModel(contentType, content.description || content.title || '');
    
    // Log model selection
    this.notifier.modelSwitchNotification('current', modelSelection.model, modelSelection.reason);
    
    // Sanitize content if it's a string
    let sanitizedContent = content.content;
    if (typeof content.content === 'string') {
      sanitizedContent = this.validator.sanitize(content.content);
    }
    
    // Return processed content with selected model
    return {
      processedContent: {
        ...content,
        type: contentType,
        content: sanitizedContent
      },
      selectedModel: modelSelection.model,
      warnings: validation.errors
    };
  }
}