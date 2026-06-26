import React from 'react';
import { Mic, MicOff } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSpeechToText } from '../../hooks/useSpeechToText';

// Appends recognized speech to existing text, inserting a space if needed.
function appendTranscript(current: string, addition: string): string {
  if (!addition) return current;
  if (!current) return addition;
  return /\s$/.test(current) ? current + addition : current + ' ' + addition;
}

interface MicButtonProps {
  value: string;
  onValueChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
  lang?: string;
}

// Standalone mic toggle — drives a value via onValueChange.
export const MicButton: React.FC<MicButtonProps> = ({
  value,
  onValueChange,
  disabled,
  className,
  lang,
}) => {
  const { isSupported, isListening, toggle } = useSpeechToText({
    lang,
    onResult: (text) => onValueChange(appendTranscript(value, text)),
  });

  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
      title={isListening ? 'Stop voice input' : 'Speak to fill this field'}
      className={cn(
        'inline-flex items-center justify-center rounded-md transition-colors',
        isListening
          ? 'text-red-600 bg-red-50 animate-pulse'
          : 'text-neutral-400 hover:text-primary-600 hover:bg-primary-50',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {isListening ? <MicOff size={18} /> : <Mic size={18} />}
    </button>
  );
};

type VoiceInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
> & {
  value: string;
  onValueChange: (next: string) => void;
  lang?: string;
  containerClassName?: string;
};

// Drop-in text input with an embedded mic button.
export const VoiceInput: React.FC<VoiceInputProps> = ({
  value,
  onValueChange,
  lang,
  className,
  containerClassName,
  disabled,
  style,
  ...rest
}) => {
  return (
    <div className={cn('relative', containerClassName)}>
      <input
        {...rest}
        type={rest.type || 'text'}
        value={value}
        disabled={disabled}
        onChange={(e) => onValueChange(e.target.value)}
        className={className}
        // Inline padding reserves room for the mic without a pr-* class that
        // could clash with existing px-*/pr-* (cn() here is clsx, no merge).
        style={{ paddingRight: '2.75rem', ...style }}
      />
      <MicButton
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        lang={lang}
        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
      />
    </div>
  );
};

type VoiceTextareaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'value' | 'onChange'
> & {
  value: string;
  onValueChange: (next: string) => void;
  lang?: string;
  containerClassName?: string;
};

// Drop-in textarea with a mic button pinned to the top-right corner.
export const VoiceTextarea: React.FC<VoiceTextareaProps> = ({
  value,
  onValueChange,
  lang,
  className,
  containerClassName,
  disabled,
  style,
  ...rest
}) => {
  return (
    <div className={cn('relative', containerClassName)}>
      <textarea
        {...rest}
        value={value}
        disabled={disabled}
        onChange={(e) => onValueChange(e.target.value)}
        className={className}
        // Reserve room for the top-right mic (see note in VoiceInput).
        style={{ paddingRight: '2.75rem', ...style }}
      />
      <MicButton
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        lang={lang}
        className="absolute right-2 top-2 h-8 w-8"
      />
    </div>
  );
};

export default VoiceInput;
