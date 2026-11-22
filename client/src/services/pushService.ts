import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, ActionPerformed } from '@capacitor/push-notifications';
import { api } from './api';

export const initPushNotifications = async (onSelectRoom?: (roomId: string) => void) => {
  if (!Capacitor.isNativePlatform()) {
    console.log('Push notifications: Running in web browser, skipping native FCM registration');
    return;
  }

  try {
    // 1. Create Android Notification Channel for Sound and Vibration
    await PushNotifications.createChannel({
      id: 'chat_messages',
      name: 'Сообщения чата',
      description: 'Звуковые уведомления о новых сообщениях в чате',
      importance: 5, // High importance (plays sound and shows heads-up notification)
      visibility: 1, // Public on lockscreen
      sound: 'default',
      vibration: true,
      lights: true,
      lightColor: '#6366f1',
    });

    // 2. Request permission
    const permStatus = await PushNotifications.checkPermissions();
    let receive = permStatus.receive;

    if (receive === 'prompt' || receive === 'prompt-with-rationale') {
      const requestResult = await PushNotifications.requestPermissions();
      receive = requestResult.receive;
    }

    if (receive !== 'granted') {
      console.warn('Push notification permission was denied by user');
      return;
    }

    // 3. Register with Apple / Google FCM
    await PushNotifications.register();

    // 4. Listeners
    // Registration success: send token to backend
    await PushNotifications.addListener('registration', async (token: Token) => {
      console.log('FCM Device Token registered:', token.value);
      try {
        await api.post('/users/push-token', { token: token.value });
      } catch (err) {
        console.warn('Failed to save push token on backend:', err);
      }
    });

    // Registration error
    await PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Push notification registration error:', error);
    });

    // When notification is clicked by user
    await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      const roomId = action.notification.data?.roomId;
      if (roomId && onSelectRoom) {
        onSelectRoom(roomId);
      }
    });
  } catch (err) {
    console.error('Error initializing push notifications:', err);
  }
};
