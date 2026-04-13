// ─── Mock Data ────────────────────────────────────────────────────────────────
// In production, replace these exports with API / Supabase calls placed in
// /src/shared/api/. The rest of the app imports types from /src/entities
// and data from this file – nothing else needs to change.

import type { Stream } from "@/entities/stream/model/types";
import type { Category } from "@/entities/category/model/types";
import type { ChatMessage } from "@/entities/message/model/types";
import { CHAT_COLORS } from "@/shared/lib/constants";

export type { Stream, Category, ChatMessage };

// ── Categories ──────────────────────────────────────────────────────────────

export const categories: Category[] = [
  {
    id: "gaming",
    name: "Gaming",
    viewers: 245000,
    image:
      "https://images.unsplash.com/photo-1665041982909-8a86864a1e49?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aWRlbyUyMGdhbWUlMjBzZXR1cHxlbnwxfHx8fDE3NzI5NzUzNzJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "music",
    name: "Music",
    viewers: 89000,
    image:
      "https://images.unsplash.com/photo-1637759898746-283c2d6c24c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtdXNpYyUyMHByb2R1Y2VyJTIwc3R1ZGlvfGVufDF8fHx8MTc3Mjk3NTM3Mnww&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "cooking",
    name: "Cooking",
    viewers: 45000,
    image:
      "https://images.unsplash.com/photo-1592498546551-222538011a27?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb29raW5nJTIwY2hlZiUyMGtpdGNoZW58ZW58MXx8fHwxNzcyOTc1MzcyfDA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "art",
    name: "Art",
    viewers: 67000,
    image:
      "https://images.unsplash.com/photo-1759486999883-4797c4e28c90?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnQlMjBwYWludGluZyUyMGNyZWF0aXZlfGVufDF8fHx8MTc3Mjg3NTc1OXww&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "fitness",
    name: "Fitness",
    viewers: 34000,
    image:
      "https://images.unsplash.com/photo-1584827386916-b5351d3ba34b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaXRuZXNzJTIwd29ya291dCUyMGd5bXxlbnwxfHx8fDE3NzI5NTcxMjd8MA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "podcast",
    name: "Podcasts",
    viewers: 56000,
    image:
      "https://images.unsplash.com/photo-1627667050609-d4ba6483a368?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwb2RjYXN0JTIwcmVjb3JkaW5nJTIwbWljcm9waG9uZXxlbnwxfHx8fDE3NzI4OTMwMTh8MA&ixlib=rb-4.1.0&q=80&w=1080",
  },
];

// ── Streams ──────────────────────────────────────────────────────────────────

export const streams: Stream[] = [
  {
    id: "1",
    title: "Championship Finals - Road to Victory!",
    streamer: "ProGamer_Mike",
    category: "Gaming",
    viewers: 12543,
    thumbnail:
      "https://images.unsplash.com/photo-1759709690954-8cd33574f022?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlc3BvcnRzJTIwY29tcGV0aXRpb258ZW58MXx8fHwxNzcyOTAxMTczfDA&ixlib=rb-4.1.0&q=80&w=1080",
    isLive: true,
    tags: ["Esports", "Competitive", "English"],
  },
  {
    id: "2",
    title: "Chill Music Production Session 🎵",
    streamer: "BeatMaker_Sarah",
    category: "Music",
    viewers: 4521,
    thumbnail:
      "https://images.unsplash.com/photo-1637759898746-283c2d6c24c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtdXNpYyUyMHByb2R1Y2VyJTIwc3R1ZGlvfGVufDF8fHx8MTc3Mjk3NTM3Mnww&ixlib=rb-4.1.0&q=80&w=1080",
    isLive: true,
    tags: ["Lo-fi", "Production", "Chill"],
  },
  {
    id: "3",
    title: "Italian Pasta Masterclass",
    streamer: "ChefAlessandro",
    category: "Cooking",
    viewers: 3289,
    thumbnail:
      "https://images.unsplash.com/photo-1592498546551-222538011a27?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb29raW5nJTIwY2hlZiUyMGtpdGNoZW58ZW58MXx8fHwxNzcyOTc1MzcyfDA&ixlib=rb-4.1.0&q=80&w=1080",
    isLive: true,
    tags: ["Italian", "Cooking", "Tutorial"],
  },
  {
    id: "4",
    title: "Digital Portrait Painting",
    streamer: "ArtistEmily",
    category: "Art",
    viewers: 2156,
    thumbnail:
      "https://images.unsplash.com/photo-1759486999883-4797c4e28c90?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnQlMjBwYWludGluZyUyMGNyZWF0aXZlfGVufDF8fHx8MTc3Mjg3NTc1OXww&ixlib=rb-4.1.0&q=80&w=1080",
    isLive: true,
    tags: ["Digital Art", "Portrait", "Tutorial"],
  },
  {
    id: "5",
    title: "Morning Workout - Full Body Session",
    streamer: "FitLife_Jake",
    category: "Fitness",
    viewers: 1834,
    thumbnail:
      "https://images.unsplash.com/photo-1584827386916-b5351d3ba34b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaXRuZXNzJTIwd29ya291dCUyMGd5bXxlbnwxfHx8fDE3NzI5NTcxMjd8MA&ixlib=rb-4.1.0&q=80&w=1080",
    isLive: true,
    tags: ["Fitness", "Workout", "Motivation"],
  },
  {
    id: "6",
    title: "Late Night Gaming Marathon",
    streamer: "StreamQueen",
    category: "Gaming",
    viewers: 8932,
    thumbnail:
      "https://images.unsplash.com/photo-1665041982909-8a86864a1e49?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aWRlbyUyMGdhbWUlMjBzZXR1cHxlbnwxfHx8fDE3NzI5NzUzNzJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    isLive: true,
    tags: ["Gaming", "Marathon", "Variety"],
  },
  {
    id: "7",
    title: "Tech Talk: AI & Future",
    streamer: "TechPodcast",
    category: "Podcasts",
    viewers: 2678,
    thumbnail:
      "https://images.unsplash.com/photo-1627667050609-d4ba6483a368?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwb2RjYXN0JTIwcmVjb3JkaW5nJTIwbWljcm9waG9uZXxlbnwxfHx8fDE3NzI4OTMwMTh8MA&ixlib=rb-4.1.0&q=80&w=1080",
    isLive: true,
    tags: ["Podcast", "Tech", "AI"],
  },
  {
    id: "8",
    title: "Pro Player Practice Session",
    streamer: "EsportsLegend",
    category: "Gaming",
    viewers: 15234,
    thumbnail:
      "https://images.unsplash.com/photo-1760377821978-636dcc65eb48?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnYW1pbmclMjBzdHJlYW1lciUyMGhlYWRwaG9uZXN8ZW58MXx8fHwxNzcyOTc1MzcxfDA&ixlib=rb-4.1.0&q=80&w=1080",
    isLive: true,
    tags: ["Pro", "Gaming", "Educational"],
  },
];

// ── Chat Seed Data ────────────────────────────────────────────────────────────

const USERNAMES = [
  "GamerGirl123", "ChillViewer", "ProFan2024", "StreamEnjoyer",
  "NightOwl", "CasualWatcher", "SuperFan99", "NewViewer",
  "RegularJoe", "HypeUser",
];

const MESSAGES = [
  "This is amazing!", "Great stream!", "Let's gooo!", "POG",
  "That was sick!", "Love this content", "First time here, loving it!",
  "Can't wait for more", "You're the best!", "Wow that was impressive",
  "Keep it up!", "This is fire 🔥", "LET'S GOOOO", "Insane play!",
  "Beautiful work",
];

export function generateMockChatMessages(): ChatMessage[] {
  const batchId = Date.now();
  return Array.from({ length: 50 }, (_, i) => ({
    id: `msg-${batchId}-${i}`,
    username: USERNAMES[Math.floor(Math.random() * USERNAMES.length)],
    message: MESSAGES[Math.floor(Math.random() * MESSAGES.length)],
    timestamp: new Date(Date.now() - Math.random() * 600_000),
    color: CHAT_COLORS[Math.floor(Math.random() * CHAT_COLORS.length)],
  }));
}
