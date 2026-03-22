import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

type SidebarContextValue = {
  isOpen: boolean;
  isCollapsed: boolean;
  isMobile: boolean;
  isTablet: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  toggleCollapsed: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

function getViewportState() {
  const width = window.innerWidth;
  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width <= 1024,
  };
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(() => (typeof window !== "undefined" ? window.innerWidth >= 768 : true));
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [{ isMobile, isTablet }, setViewport] = useState(() =>
    typeof window !== "undefined" ? getViewportState() : { isMobile: false, isTablet: false }
  );

  useEffect(() => {
    const handleResize = () => {
      const nextViewport = getViewportState();
      setViewport(nextViewport);

      if (nextViewport.isMobile) {
        setIsOpen(false);
      } else if (nextViewport.isTablet) {
        setIsOpen(true);
        setIsCollapsed(true);
      } else {
        setIsOpen(true);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, isOpen]);

  const value = useMemo<SidebarContextValue>(
    () => ({
      isOpen,
      isCollapsed: isTablet ? true : isCollapsed,
      isMobile,
      isTablet,
      openSidebar: () => setIsOpen(true),
      closeSidebar: () => setIsOpen(false),
      toggleSidebar: () => setIsOpen((prev) => !prev),
      toggleCollapsed: () => {
        if (!isMobile && !isTablet) {
          setIsCollapsed((prev) => !prev);
        }
      },
    }),
    [isCollapsed, isMobile, isOpen, isTablet]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar debe usarse dentro de SidebarProvider");
  }
  return context;
}
