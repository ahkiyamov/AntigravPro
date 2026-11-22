import { initializeApp, cert, App } from 'firebase-admin/app';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import path from 'path';
import fs from 'fs';
import { prisma } from '../prisma.js';

let firebaseApp: App | null = null;
let isFcmInitialized = false;

// Check for firebase-service-account.json
const serviceAccountPath = path.resolve(process.cwd(), 'firebase-service-account.json');

try {
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    firebaseApp = initializeApp({
      credential: cert(serviceAccount),
    });
    isFcmInitialized = true;
    console.log('✅ [FCM] Firebase Admin SDK successfully initialized.');
  } else {
    console.log(
      'ℹ️ [FCM] firebase-service-account.json not found in server directory. Push notifications will be simulated until file is added.'
    );
  }
} catch (err) {
  console.warn('⚠️ [FCM] Could not initialize Firebase Admin SDK:', err);
}

// Save or update device token for user
export const saveDeviceToken = async (userId: string, token: string) => {
  try {
    await prisma.deviceToken.upsert({
      where: { token },
      update: { userId },
      create: { userId, token },
    });
    console.log(`📱 [FCM] Saved device token for user ${userId}`);
  } catch (err) {
    console.error('Error saving device token:', err);
  }
};

// Send push notification to target users
export const sendPushToUsers = async (
  userIds: string[],
  payload: {
    title: string;
    body: string;
    roomId: string;
    avatar?: string | null;
  }
) => {
  try {
    if (userIds.length === 0) return;

    // 1. Fetch tokens for these users from database
    const deviceRecords = await prisma.deviceToken.findMany({
      where: {
        userId: { in: userIds },
      },
    });

    if (deviceRecords.length === 0) {
      return;
    }

    const tokens = deviceRecords.map((d) => d.token);

    if (!isFcmInitialized || !firebaseApp) {
      console.log(`🔔 [FCM Simulation] Would send push to ${tokens.length} devices:`, {
        title: payload.title,
        body: payload.body,
        roomId: payload.roomId,
      });
      return;
    }

    // 2. Prepare high-priority multicast message
    const message: MulticastMessage = {
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        roomId: payload.roomId,
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'chat_messages',
          sound: 'default',
          defaultSound: true,
          defaultVibrateTimings: true,
          priority: 'high',
          visibility: 'public',
        },
      },
    };

    // 3. Send through Firebase
    const messaging = getMessaging(firebaseApp);
    const response = await messaging.sendEachForMulticast(message);
    console.log(
      `🚀 [FCM] Sent push notification: ${response.successCount} success, ${response.failureCount} failed.`
    );

    // 4. Remove invalid tokens if any
    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errCode = resp.error?.code;
          if (
            errCode === 'messaging/invalid-registration-token' ||
            errCode === 'messaging/registration-token-not-registered'
          ) {
            failedTokens.push(tokens[idx]);
          }
        }
      });

      if (failedTokens.length > 0) {
        await prisma.deviceToken.deleteMany({
          where: { token: { in: failedTokens } },
        });
        console.log(`🧹 [FCM] Cleaned up ${failedTokens.length} expired tokens.`);
      }
    }
  } catch (err) {
    console.error('Error sending push notification via FCM:', err);
  }
};
