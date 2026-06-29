import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// Notification sound as base64 data URL (short beep)
const NOTIFICATION_SOUND_URL = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkZeLgXRtcH2Kl5+Xi3tuam19i5mjnJOEd29veIWRm56bkIN3cXF5hZGanJyWi394c3R6hI+Wm5uYkId9d3V4gIuUmZqYk4qBe3h3eoSNk5eYl5OLhH57eXuDi5GTlZWTj4mDfnx7fYSKjpGTk5GMh4N/fXx+g4mNkJGRj4uHg4B+fYCEiIuOj4+NioeDgX9+gIOGiYuNjYuJhoSBf3+AgoWHiouLioiGhIKAf4CCg4aIiYqKiIaFg4GAgIGDhYeIiYmIhoWDgoCAgoOFhoeIiIeGhYOCgYGCg4SFhoeHhoWEg4KBgYKDhIWGh4aGhYSCgoGBgoOEhYaGhoWEg4KCgYGCg4SFhoaFhYSEg4KBgoKDhIWFhYWEhIOCgoKCg4OEhYWFhISDgoKCgoKDhISFhYSEg4OCgoKCg4OEhISEhISEg4KCgoKDg4SEhISEg4OCgoKCgoODhISEhISDg4KCgoKDg4OEhISEg4ODgoKCgoKDg4SEhISDg4OCgoKCg4ODg4SEhIODg4KCgoKCg4ODhISDg4ODgoKCgoKDg4OEg4ODg4OCgoKCg4ODg4ODg4ODg4KCgoKCg4ODg4ODg4OCgoKCgoKDg4ODg4ODg4KCgoKCg4ODg4ODg4OCgoKCgoKDg4ODg4ODgoKCgoKCgoODg4ODg4OCgoKCgoKDg4ODg4ODgoKC';

export function useRealtimeOrders(onNewOrder) {
  const { restaurant } = useAuth();
  const audioRef = useRef(null);
  const channelRef = useRef(null);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
    audioRef.current.volume = 0.8;
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    } catch (e) {
      // Audio play failed, silently ignore
    }
  }, []);

  const showBrowserNotification = useCallback((order) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🍽️ Nouvelle commande !', {
        body: `Table ${order.table_number} — ${order.total?.toFixed(2) || '0.00'} FCFA`,
        icon: '/icons/icon-192.png',
        tag: `order-${order.id}`,
        renotify: true,
        vibrate: [200, 100, 200]
      });
    }
  }, []);

  useEffect(() => {
    if (!restaurant?.id) return;

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Subscribe to realtime orders
    channelRef.current = supabase
      .channel(`orders-${restaurant.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurant.id}`
        },
        (payload) => {
          const newOrder = payload.new;
          playNotificationSound();
          showBrowserNotification(newOrder);
          if (onNewOrder) onNewOrder(newOrder);
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [restaurant?.id, onNewOrder, playNotificationSound, showBrowserNotification]);

  return { playNotificationSound };
}
