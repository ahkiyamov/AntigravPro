// Notification and sound utilities

// Web Audio API synthesized notification sound (no external file needed)
export const playNotificationSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // If context suspended due to autoplay policy, try to resume
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Two-tone pleasant chime: D5 (587.33Hz) -> A5 (880Hz)
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    console.warn('Audio notification error:', e);
  }
};

// Request Web Notification permission
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) {
    console.warn('Browser does not support desktop notifications');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    return await Notification.requestPermission();
  }

  return Notification.permission;
};

// Show native OS / browser notification
export const showBrowserNotification = (
  title: string,
  options: {
    body: string;
    icon?: string | null;
    tag?: string;
    onClick?: () => void;
  }
) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    const notif = new Notification(title, {
      body: options.body,
      icon: options.icon || 'https://api.dicebear.com/7.x/bottts/svg?seed=Chat',
      tag: options.tag || 'chat-message',
    });

    if (options.onClick) {
      notif.onclick = () => {
        window.focus();
        options.onClick!();
        notif.close();
      };
    }
  } catch (err) {
    console.warn('Failed to show notification:', err);
  }
};
