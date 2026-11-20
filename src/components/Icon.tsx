import type { ReactNode } from "react";

export type IconName =
  | "arrow"
  | "balloon"
  | "camera"
  | "cameraOff"
  | "chat"
  | "chevron"
  | "close"
  | "fullscreen"
  | "gift"
  | "heart"
  | "home"
  | "mic"
  | "micOff"
  | "party"
  | "play"
  | "send"
  | "sparkle"
  | "users";

export const Icon = ({ name, size = 20 }: { name: IconName; size?: number }) => {
  const paths: Record<IconName, ReactNode> = {
    arrow: <><path d="m9 18 6-6-6-6" /></>,
    balloon: <><path d="M16 8c0 4-1.8 7-4 7s-4-3-4-7 1.8-5 4-5 4 1 4 5Z" /><path d="m10 15 2 2 2-2M12 17c-2 2 2 3 0 5" /></>,
    camera: <><path d="m16 9 5-3v12l-5-3Z" /><rect x="3" y="5" width="13" height="14" rx="3" /></>,
    cameraOff: <><path d="m3 3 18 18M10.5 5H6a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h10M16 8l5-2v10M16 13V8a3 3 0 0 0-3-3h-1" /></>,
    chat: <><path d="M21 14a4 4 0 0 1-4 4H9l-6 3v-7a4 4 0 0 1-1-2.6V7a4 4 0 0 1 4-4h11a4 4 0 0 1 4 4Z" /><path d="M7 10h.01M12 10h.01M17 10h.01" /></>,
    chevron: <><path d="m6 9 6 6 6-6" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    fullscreen: <><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" /></>,
    gift: <><path d="M20 12v9H4v-9M2 7h20v5H2zM12 7v14M12 7H7.5a2.5 2.5 0 1 1 2.1-3.85L12 7Zm0 0h4.5a2.5 2.5 0 1 0-2.1-3.85L12 7Z" /></>,
    heart: <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></>,
    home: <><path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7" /></>,
    mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" /></>,
    micOff: <><path d="m3 3 18 18M9 9v2a3 3 0 0 0 4.8 2.4M15 9V5a3 3 0 0 0-5.1-2.1M5 10a7 7 0 0 0 11.8 5.1M19 10a7 7 0 0 1-.5 2.6M12 17v5M8 22h8" /></>,
    party: <><path d="m4 20 4-12 8 8-12 4Z" /><path d="m9 15 3-3M14 3v2M20 9h2M18.5 4.5 17 6M20 14l-2-1M10 2l1 2" /></>,
    play: <><path d="m8 5 11 7-11 7Z" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    sparkle: <><path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3ZM19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15ZM5 14l.7 2.3L8 17l-2.3.7L5 20l-.7-2.3L2 17l2.3-.7L5 14Z" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
};
