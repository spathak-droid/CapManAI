"use client";

import { useEffect, useRef } from "react";
import { preload } from "swr";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchLessonModules,
  fetchMyLessonProgress,
  fetchMyStreak,
  fetchLeaderboard,
  fetchDashboardOverview,
  fetchMTSSTiers,
} from "@/lib/api";

/**
 * Prefetches app data in the background once the user is known, so that
 * lessons, leaderboard, and dashboard pages read from SWR cache instead of
 * waiting on the network.
 */
export default function PrefetchData() {
  const { user, loading } = useAuth();
  const didPrefetch = useRef(false);

  useEffect(() => {
    if (!user) {
      didPrefetch.current = false;
      return;
    }
    if (loading || didPrefetch.current) return;
    didPrefetch.current = true;

    // Preload leaderboard for any logged-in user (shared across roles)
    preload("leaderboard", fetchLeaderboard);

    if (user.role === "student") {
      preload("lesson-modules", fetchLessonModules);
      preload("lesson-progress", fetchMyLessonProgress);
      preload("streak", fetchMyStreak);
    }

    if (user.role === "educator") {
      preload("dashboard-overview", fetchDashboardOverview);
      preload("mtss-tiers", fetchMTSSTiers);
    }
  }, [user, loading]);

  return null;
}
