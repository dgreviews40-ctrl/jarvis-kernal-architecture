import { BaseRenderer } from './BaseRenderer';
import { ContentRequest, RenderResult, InteractiveElement } from '../types';

export class InteractiveRenderer extends BaseRenderer {
  canRender(content: ContentRequest): boolean {
    return content.type === 'interactive';
  }

  async render(content: ContentRequest): Promise<RenderResult> {
    try {
      if (!this.canRender(content)) {
        return { success: false, error: 'Invalid content type for InteractiveRenderer' };
      }

      // Create a DOM element for the interactive content
      const container = document.createElement('div');
      container.className = 'display-interactive-content';
      
      // Parse the interactive content
      const interactiveData = typeof content.content === 'string' 
        ? JSON.parse(content.content) 
        : content.content as InteractiveElement;
      
      // Create appropriate interactive elements based on type
      switch (interactiveData.type) {
        case 'button':
          const button = document.createElement('button');
          button.className = 'interactive-button bg-cyan-700 hover:bg-cyan-600 text-white px-4 py-2 rounded';
          button.textContent = interactiveData.content.text || 'Button';
          if (interactiveData.onClick) {
            button.onclick = interactiveData.onClick;
          }
          container.appendChild(button);
          break;
          
        case 'card':
          const card = document.createElement('div');
          card.className = 'interactive-card bg-gray-800 border border-cyan-700 rounded p-4';
          
          if (interactiveData.content.title) {
            const title = document.createElement('h3');
            title.className = 'text-lg font-bold mb-2';
            title.textContent = interactiveData.content.title;
            card.appendChild(title);
          }
          
          if (interactiveData.content.description) {
            const desc = document.createElement('p');
            desc.className = 'text-sm mb-2';
            desc.textContent = interactiveData.content.description;
            card.appendChild(desc);
          }
          
          if (interactiveData.content.buttonText) {
            const actionButton = document.createElement('button');
            actionButton.className = 'mt-2 bg-cyan-700 hover:bg-cyan-600 text-white px-3 py-1 rounded text-sm';
            actionButton.textContent = interactiveData.content.buttonText;
            if (interactiveData.onClick) {
              actionButton.onclick = interactiveData.onClick;
            }
            card.appendChild(actionButton);
          }
          
          container.appendChild(card);
          break;
          
        case 'form':
          const form = document.createElement('form');
          form.className = 'interactive-form bg-gray-800 border border-cyan-700 rounded p-4';
          
          if (interactiveData.content.fields) {
            interactiveData.content.fields.forEach((field: any) => {
              const label = document.createElement('label');
              label.className = 'block text-sm mb-1';
              label.textContent = field.label;
              
              let input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
              switch (field.type) {
                case 'textarea':
                  input = document.createElement('textarea');
                  break;
                case 'select':
                  input = document.createElement('select');
                  if (field.options) {
                    field.options.forEach((option: any) => {
                      const optionEl = document.createElement('option');
                      optionEl.value = option.value;
                      optionEl.textContent = option.label;
                      (input as HTMLSelectElement).appendChild(optionEl);
                    });
                  }
                  break;
                default:
                  input = document.createElement('input');
                  input.type = field.type || 'text';
              }
              
              input.className = 'w-full p-2 bg-gray-700 border border-cyan-600 rounded text-white';
              input.placeholder = field.placeholder || '';
              input.value = field.value || '';
              
              form.appendChild(label);
              form.appendChild(input);
              form.appendChild(document.createElement('br'));
            });
          }
          
          if (interactiveData.content.submitText) {
            const submitBtn = document.createElement('button');
            submitBtn.type = 'submit';
            submitBtn.className = 'mt-2 bg-cyan-700 hover:bg-cyan-600 text-white px-4 py-2 rounded';
            submitBtn.textContent = interactiveData.content.submitText;
            
            if (interactiveData.onInteraction) {
              form.onsubmit = (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const data: Record<string, any> = {};
                for (const [key, value] of formData.entries()) {
                  data[key] = value;
                }
                interactiveData.onInteraction(data);
              };
            }
            
            form.appendChild(submitBtn);
          }
          
          container.appendChild(form);
          break;
          
        default:
          return { success: false, error: `Unsupported interactive element type: ${interactiveData.type}` };
      }
      
      if (content.title) {
        const titleEl = document.createElement('h3');
        titleEl.className = 'text-lg font-bold mb-2';
        titleEl.textContent = content.title;
        container.insertBefore(titleEl, container.firstChild);
      }
      
      if (content.description) {
        const descEl = document.createElement('div');
        descEl.className = 'text-xs text-cyan-700 mt-2';
        descEl.textContent = content.description;
        container.appendChild(descEl);
      }

      return { 
        success: true, 
        element: container 
      };
    } catch (error) {
      return { 
        success: false, 
        error: `InteractiveRenderer error: ${(error as Error).message}` 
      };
    }
  }
}