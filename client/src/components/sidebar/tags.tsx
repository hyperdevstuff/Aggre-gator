import { type Tag } from "@/types/index";
import { TagsIcon } from "lucide-react";
import { SidebarMenuBadge } from "../ui/sidebar";

type SidebarTagsProps = Tag;

export default function SideBarTags({
  id,
  count,
  color,
  name,
  // ...props
}: SidebarTagsProps) {
  console.log(id);
  return (
    <div>
      <TagsIcon color={color}></TagsIcon>
      <div>{name}</div>
      <SidebarMenuBadge>{count}</SidebarMenuBadge>
    </div>
  );
}
