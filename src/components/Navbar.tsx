import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { AnimatedMenuIcon } from "@/components/AnimatedMenuIcon";
import logo from "@/assets/gear-puzzle-icon.png";

interface NavbarProps {
  user: any;
}

const Navbar = ({ user }: NavbarProps) => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm shadow-medium">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            {user && <AnimatedMenuIcon />}
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-xl font-bold text-primary font-orbitron"
            >
              <img src={logo} alt="PARTSPRO logo" className="h-6 w-6 object-contain" />
              PARTSPRO
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-md hover:bg-accent/10 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5 text-foreground" />
              ) : (
                <Moon className="h-5 w-5 text-foreground" />
              )}
            </button>
            
            {!user && (
              <button
                onClick={() => navigate("/auth")}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 transition-colors"
              >
                SIGN IN
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
