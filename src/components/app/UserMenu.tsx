import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconLogout, IconSettings } from "@/components/ui-custom/CustomIcon";

export function UserMenu() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  if (!user) return null;

  const meta = user.user_metadata ?? {};
  const discordName = String(meta.name || meta.username || user.email?.split("@")[0] || "Account");
  const avatar = typeof meta.avatar_url === "string" ? meta.avatar_url : null;
  const initial = discordName[0]?.toUpperCase() ?? "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Account menu"
          className="group inline-flex items-center gap-2 rounded-full border border-glass-border bg-glass/50 py-1 pl-1 pr-3 text-xs text-muted-foreground backdrop-blur-xl transition hover:border-primary/30 hover:text-foreground"
        >
          {avatar ? (
            <img src={avatar} alt="" className="size-7 rounded-full object-cover" />
          ) : (
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-primary/70 to-accent/70 font-display text-[11px] font-medium text-primary-foreground">
              {initial}
            </span>
          )}
          <span className="hidden max-w-[160px] truncate md:inline">{discordName}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56 border-glass-border bg-popover/95 backdrop-blur-xl">
        <DropdownMenuLabel className="font-normal">
          <div className="font-display text-sm text-foreground">{discordName}</div>
          {user.email ? <div className="truncate text-xs text-muted-foreground">{user.email}</div> : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/account" className="flex items-center gap-2">
            <IconSettings size={14} />
            <span>Account / PSN</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/settings" className="flex items-center gap-2">
            <IconSettings size={14} />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async (e) => {
            e.preventDefault();
            await signOut();
            nav({ to: "/login", search: { redirect: "/dashboard", mode: "signin" as const }, replace: true });
          }}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <IconLogout size={14} />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
