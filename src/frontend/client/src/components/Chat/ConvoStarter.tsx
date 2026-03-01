interface ConvoStarterProps {
  text: string;
  onClick: () => void;
}

export default function ConvoStarter({ text, onClick }: ConvoStarterProps) {
  return (
    <button
      onClick={onClick}
      className="relative flex w-40 cursor-pointer flex-col gap-2 rounded-2xl border border-border-medium px-3 pb-4 pt-3 text-start align-top text-[15px] shadow-[0_0_2px_0_rgba(0,0,0,0.05),0_4px_6px_0_rgba(0,0,0,0.02)] transition-colors duration-300 ease-in-out fade-in hover:bg-surface-tertiary dark:bg-gray-800/60 dark:border-gray-600/60 dark:shadow-[0_0_4px_0_rgba(0,0,0,0.2)] dark:hover:bg-gray-700/70 dark:backdrop-blur-sm"
    >
      <p className="break-word line-clamp-3 overflow-hidden text-balance break-all text-text-secondary">
        {text}
      </p>
    </button>
  );
}
