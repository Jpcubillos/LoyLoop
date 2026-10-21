export function LoyLoopLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative grid h-10 w-10 place-items-center rounded-[14px] bg-gradient-to-br from-[#FF6B6B] via-[#FA4059] to-[#FF4D8D] text-white shadow-[0_8px_18px_rgba(250,64,89,.2)]">
        <div className="absolute h-4 w-6 rounded-full border-2 border-white" />
        <div className="absolute h-6 w-4 rounded-full border-2 border-white/80" />
      </div>
      <span className="text-xl font-bold tracking-[-.035em] text-ink">LoyLoop</span>
    </div>
  );
}
