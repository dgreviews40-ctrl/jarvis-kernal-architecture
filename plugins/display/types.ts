import { PluginManifest } from '../types';

export interface DisplayPluginConfig {
  defaultModel: string;
  visionModel: string;
  textModel: string;
  maxContentSize: number;
  enableCaching: boolean;
  supportedFormats: string[];
}

export interface ContentRequest {
  type: 'text' | 'image' | 'svg' | 'pdf' | 'diagram' | 'interactive' | 'web';
  content: string | ArrayBuffer;
  title?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface RenderResult {
  success: boolean;
  element?: HTMLElement | React.ReactElement;
  error?: string;
  warnings?: string[];
}

export interface ModelSelection {
  model: string;
  reason: string;
  confidence: number;
}

export interface InteractiveElement {
  type: 'button' | 'card' | 'slider' | 'form';
  content: any;
  onClick?: () => void;
  onInteraction?: (data: any) => void;
}