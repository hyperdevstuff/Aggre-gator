import { SidebarGroupAction, SidebarMenuAction } from "../ui/sidebar";
import { MoreVertical, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface SidebarDropDownMenuProps {
  name: string;
}

export default function SidebarDropDownMenu({
  name,
}: SidebarDropDownMenuProps) {
  return (
    <div>
      <SidebarGroupAction title="Add Project">
        <Plus /> <span className="sr-only">Add {name}</span>
      </SidebarGroupAction>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction>
            <MoreVertical />
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem>
            <span>Edit {name}</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <span>Delete {name}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
