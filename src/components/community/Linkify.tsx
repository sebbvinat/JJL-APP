'use client';

import React from 'react';

// Splits free text into plain segments + clickable URL links.
// Matches http(s):// and bare www. prefixes; auto-prepends https:// for the latter.
const URL_REGEX = /(\b(?:https?:\/\/|www\.)[^\s<>"'()]+[^\s<>"'.,;:!?)\]])/gi;

interface LinkifyProps {
  text: string;
  className?: string;
}

export function Linkify({ text, className }: LinkifyProps) {
  if (!text) return null;
  const parts = text.split(URL_REGEX);
  return (
    <>
      {parts.map((part, i) => {
        if (URL_REGEX.test(part)) {
          // Reset lastIndex because we use a global regex above
          URL_REGEX.lastIndex = 0;
          const href = part.startsWith('http') ? part : `https://${part}`;
          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={className || 'text-jjl-red underline hover:text-red-400 break-all'}
            >
              {part}
            </a>
          );
        }
        URL_REGEX.lastIndex = 0;
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}
