import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function AppShellSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B201F] px-6 text-[#F6F9F2]">
      <Card className="w-full max-w-md border-[#2B4E44] bg-[#102825]">
        <CardHeader className="space-y-3">
          <Skeleton className="h-4 w-32 bg-[#FFFFFF1A]" />
          <Skeleton className="h-3 w-52 bg-[#FFFFFF12]" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full rounded-xl bg-[#FFFFFF12]" />
          <Skeleton className="h-12 w-full rounded-xl bg-[#FFFFFF12]" />
          <Skeleton className="h-12 w-full rounded-xl bg-[#FFFFFF12]" />
        </CardContent>
      </Card>
    </div>
  );
}

export function BrokerSelectionSkeleton() {
  return (
    <div className="w-full flex flex-col items-center">
      <div className="text-center mb-10 w-full">
        <Skeleton className="mx-auto h-12 w-72 bg-[#FFFFFF12]" />
        <Skeleton className="mx-auto mt-4 h-4 w-96 max-w-full bg-[#FFFFFF12]" />
      </div>
      <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="border-[#2B4E44] bg-[#0B201F]">
            <CardContent className="flex flex-col items-center p-5 text-center md:p-6">
              <Skeleton className="mb-4 size-14 rounded-full bg-[#FFFFFF12]" />
              <Skeleton className="h-5 w-28 bg-[#FFFFFF12]" />
              <Skeleton className="mt-2 h-3 w-36 bg-[#FFFFFF12]" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-10 w-full max-w-sm">
        <Skeleton className="h-14 w-full rounded-xl bg-[#FFFFFF12]" />
        <Skeleton className="mx-auto mt-4 h-3 w-60 bg-[#FFFFFF12]" />
      </div>
    </div>
  );
}

export function LoginFormSkeleton() {
  return (
    <Card className="mx-auto w-full max-w-[640px] rounded-3xl border-[#2B4E44] bg-[#102825]">
      <CardHeader className="space-y-3">
        <Skeleton className="h-4 w-28 bg-[#FFFFFF1A]" />
        <Skeleton className="h-9 w-56 bg-[#FFFFFF12]" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-12 w-full rounded-2xl bg-[#FFFFFF12]" />
        <Skeleton className="h-12 w-full rounded-2xl bg-[#FFFFFF12]" />
        <Skeleton className="h-12 w-full rounded-2xl bg-[#FFFFFF12]" />
        <Skeleton className="mt-2 h-12 w-full rounded-2xl bg-[#FFFFFF1A]" />
      </CardContent>
    </Card>
  );
}

export function DashboardShellSkeleton() {
  return (
    <div className="flex min-h-screen bg-[#0B201F] text-[#F6F9F2]">
      <aside className="hidden w-72 border-r border-[#2B4E44] bg-[#102825] p-6 lg:block">
        <Skeleton className="h-8 w-32 bg-[#FFFFFF12]" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-11 w-full rounded-xl bg-[#FFFFFF12]" />
          ))}
        </div>
      </aside>
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <Skeleton className="h-10 w-52 bg-[#FFFFFF12]" />
              <Skeleton className="h-4 w-72 max-w-full bg-[#FFFFFF12]" />
            </div>
            <Skeleton className="h-10 w-28 rounded-xl bg-[#FFFFFF12]" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="border-[#2B4E44] bg-[#102825]">
                <CardContent className="space-y-4 p-5">
                  <Skeleton className="h-3 w-24 bg-[#FFFFFF12]" />
                  <Skeleton className="h-8 w-32 bg-[#FFFFFF12]" />
                  <Skeleton className="h-3 w-20 bg-[#FFFFFF12]" />
                </CardContent>
              </Card>
            ))}
          </div>
          <DashboardContentSkeleton />
        </div>
      </main>
    </div>
  );
}

export function DashboardContentSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="border-[#2B4E44] bg-[#102825]">
        <CardContent className="space-y-4 p-5">
          <Skeleton className="h-4 w-40 bg-[#FFFFFF12]" />
          <Skeleton className="h-56 w-full rounded-2xl bg-[#FFFFFF12]" />
        </CardContent>
      </Card>
      <Card className="border-[#2B4E44] bg-[#102825]">
        <CardContent className="space-y-4 p-5">
          <Skeleton className="h-4 w-32 bg-[#FFFFFF12]" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-xl bg-[#FFFFFF12]" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function StockDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-9 w-24 bg-[#FFFFFF12]" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-24 rounded-full bg-[#FFFFFF12]" />
            <Skeleton className="h-7 w-24 rounded-full bg-[#FFFFFF12]" />
            <Skeleton className="h-7 w-24 rounded-full bg-[#FFFFFF12]" />
          </div>
          <Skeleton className="h-10 w-80 max-w-full bg-[#FFFFFF12]" />
          <Skeleton className="h-4 w-56 bg-[#FFFFFF12]" />
          <Skeleton className="h-4 w-full max-w-3xl bg-[#FFFFFF12]" />
          <Skeleton className="h-4 w-5/6 max-w-3xl bg-[#FFFFFF12]" />
        </div>
        <Card className="border-[#2B4E44] bg-[#0B201F] xl:min-w-[320px]">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <Skeleton className="h-4 w-24 bg-[#FFFFFF12]" />
                <Skeleton className="h-10 w-36 bg-[#FFFFFF12]" />
              </div>
              <Skeleton className="h-10 w-32 rounded-xl bg-[#FFFFFF12]" />
            </div>
            <Skeleton className="h-20 w-full rounded-2xl bg-[#FFFFFF12]" />
          </CardContent>
        </Card>
      </div>
      <Card className="border-[#2B4E44] bg-[#0B201F]">
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-72 w-full rounded-2xl bg-[#FFFFFF12]" />
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full rounded-2xl bg-[#FFFFFF12]" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
