"use client";

export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1" aria-label="Apex Sync Intelligence is responding">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-gold/60"
          style={{
            animation: "typing-bounce 1.1s ease-in-out infinite",
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}
