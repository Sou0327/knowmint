"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchUnreadCountAction,
  fetchNotificationsAction,
  markNotificationReadAction,
} from "@/app/actions/social";
import type { Notification } from "@/types/database.types";

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Fetch unread count on mount
  useEffect(() => {
    fetchUnreadCountAction().then(({ count }) => {
      setUnreadCount(count);
    }, () => {});
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchNotificationsAction();
      if (!result.error) {
        setNotifications(result.notifications);
      }
    } catch {
      // requireAuth redirect or network error — ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpen = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next) fetchNotifications();
      return next;
    });
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    // Only decrement if notification is currently unread
    const notification = notifications.find((n) => n.id === id);
    const wasUnread = notification && !notification.read;

    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    if (wasUnread) {
      setUnreadCount((c) => Math.max(0, c - 1));
    }

    try {
      const result = await markNotificationReadAction(id);
      if (result.error) {
        // Rollback: re-fetch to get accurate state
        await fetchNotifications();
        const { count } = await fetchUnreadCountAction();
        setUnreadCount(count);
      }
    } catch {
      // requireAuth redirect or network error — re-fetch
      await fetchNotifications();
      fetchUnreadCountAction().then(({ count }) => {
        setUnreadCount(count);
      }, () => {});
    }
  }, [fetchNotifications, notifications]);

  return {
    notifications,
    unreadCount,
    loading,
    open,
    setOpen,
    handleOpen,
    markAsRead,
  };
}
