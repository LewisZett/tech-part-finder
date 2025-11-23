import { useNavigate } from "react-router-dom";
import { AnimatedMenuIcon } from "@/components/AnimatedMenuIcon";
import logo from "@/assets/gear-puzzle-icon.png";

interface NavbarProps {
  user: any;
}

const Navbar = ({ user }: NavbarProps) => {
  const navigate = useNavigate();

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
    </nav>
  );
};

export default Navbar;
