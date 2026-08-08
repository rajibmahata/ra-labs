export type VoiceCommand =
  | { type: 'navigate'; path: string; label: string }
  | { type: 'back'; label: string }
  | null;

export function parseVoiceCommand(transcript: string, projectId?: string): VoiceCommand {
  const normalized = transcript.trim().toLowerCase().replace(/[.!?]+$/, '');
  if (!normalized) return null;

  if (/^(go to |open |show |take me to )?(dashboard|home)$/.test(normalized)) {
    return { type: 'navigate', path: '/dashboard', label: 'Opening dashboard.' };
  }
  if (/^(go to |open |show |take me to )?(account|profile|settings)$/.test(normalized)) {
    return { type: 'navigate', path: '/account', label: 'Opening account.' };
  }
  if (/^(go to |open |show |take me to )?(projects|my projects)$/.test(normalized)) {
    return { type: 'navigate', path: '/dashboard', label: 'Opening your projects.' };
  }
  if (/^(go )?back$/.test(normalized)) {
    return { type: 'back', label: 'Going back.' };
  }
  if (projectId && /^(open |show )?(this )?project$/.test(normalized)) {
    return { type: 'navigate', path: `/projects/${projectId}`, label: 'Opening this project.' };
  }

  return null;
}
