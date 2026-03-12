interface ClearframeBrandProps {
  titleClassName?: string;
}

export function ClearframeBrand({ titleClassName }: ClearframeBrandProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 rotate-12 items-center justify-center rounded-lg bg-gradient-to-br from-[#C4E456] to-[#8CFCBA] text-[#0B201F] shadow-sm">
        <span className="rotate-[-12deg] font-bold tracking-tighter">CF</span>
      </div>
      <h1 className={titleClassName ?? "text-xl font-bold tracking-tight text-[#F6F9F2]"}>
        ClearFrame
      </h1>
    </div>
  );
}
