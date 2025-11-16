import { useState } from "react";
import {
	Search,
	Plus,
	Star,
	Clock,
	Archive,
	Folder,
	Tag,
	MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ModeToggle } from "@/components/toogle-theme";
import { BookmarkCard } from "@/components/custom/bookmark-card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

// MOCK DATA - replace in phase 2
const MOCK_USER = {
	name: "jane doe",
	email: "jane@example.com",
	avatar: "https://github.com/shadcn.png",
};

const MOCK_COLLECTIONS = [
	{ id: "1", name: "unsorted", icon: Folder, count: 24, color: null },
	{ id: "2", name: "favorites", icon: Star, count: 12, color: "#fbbf24" },
	{ id: "3", name: "reading list", icon: Clock, count: 8, color: "#3b82f6" },
	{ id: "4", name: "archive", icon: Archive, count: 156, color: "#6b7280" },
];

const MOCK_TAGS = [
	{ id: "1", name: "design", count: 45, color: "#ef4444" },
	{ id: "2", name: "dev", count: 89, color: "#22c55e" },
	{ id: "3", name: "research", count: 23, color: "#a855f7" },
	{ id: "4", name: "inspiration", count: 34, color: "#06b6d4" },
];

const MOCK_BOOKMARKS = Array.from({ length: 12 }).map((_, i) => ({
	id: `${i}`,
	title: `example bookmark ${i + 1}`,
	url: `https://example${i}.com`,
	description:
		"some description about this bookmark that explains what it contains and why it's useful",
	domain: `example${i}.com`,
	cover: null,
	isFavorite: i % 3 === 0,
	collectionId: MOCK_COLLECTIONS[i % 4].id,
	tags: MOCK_TAGS.slice(0, (i % 3) + 1).map((t) => ({
		id: t.id,
		name: t.name,
		color: t.color,
	})),
	createdAt: new Date(Date.now() - i * 86400000).toISOString(),
	updatedAt: new Date(Date.now() - i * 86400000).toISOString(),
}));

type FilterState = {
	search: string;
	collectionId: string | null;
	tagIds: string[];
	isFavorite: boolean | null;
	sort: "created_desc" | "created_asc" | "title_asc" | "title_desc";
};

export function Dashboard() {
	const [filters, setFilters] = useState<FilterState>({
		search: "",
		collectionId: null,
		tagIds: [],
		isFavorite: null,
		sort: "created_desc",
	});

	const [isLoading] = useState(false); // will wire to tanstack query later

	// FILTERING LOGIC - move to tanstack query params in phase 2
	const filteredBookmarks = MOCK_BOOKMARKS.filter((b) => {
		if (
			filters.search &&
			!b.title.toLowerCase().includes(filters.search.toLowerCase())
		)
			return false;
		if (filters.collectionId && b.collectionId !== filters.collectionId)
			return false;
		if (filters.isFavorite !== null && b.isFavorite !== filters.isFavorite)
			return false;
		if (
			filters.tagIds.length > 0 &&
			!filters.tagIds.some((tid) => b.tags.some((t) => t.id === tid))
		)
			return false;
		return true;
	});

	const selectedCollection = MOCK_COLLECTIONS.find(
		(c) => c.id === filters.collectionId,
	);
	const selectedTags = MOCK_TAGS.filter((t) => filters.tagIds.includes(t.id));

	return (
		<SidebarProvider>
			<div className="flex h-screen w-full">
				{/* LEFT SIDEBAR */}
				<Sidebar>
					<SidebarContent>
						{/* USER PROFILE */}
						<div className="p-4 border-b">
							<div className="flex items-center gap-3">
								<Avatar className="h-9 w-9">
									<AvatarImage src={MOCK_USER.avatar} />
									<AvatarFallback>
										{MOCK_USER.name[0].toUpperCase()}
									</AvatarFallback>
								</Avatar>
								<div className="flex-1 min-w-0">
									<p className="text-sm font-medium truncate">
										{MOCK_USER.name}
									</p>
									<p className="text-xs text-muted-foreground truncate">
										{MOCK_USER.email}
									</p>
								</div>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="ghost" size="icon-sm">
											<MoreVertical className="h-4 w-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem>settings</DropdownMenuItem>
										<DropdownMenuItem variant="destructive">
											logout
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						</div>

						{/* COLLECTIONS */}
						<SidebarGroup>
							<div className="flex items-center justify-between px-2">
								<SidebarGroupLabel>collections</SidebarGroupLabel>
								<Button variant="ghost" size="icon-sm">
									<Plus className="h-4 w-4" />
								</Button>
							</div>
							<SidebarGroupContent>
								<SidebarMenu>
									<SidebarMenuItem>
										<SidebarMenuButton
											isActive={filters.collectionId === null}
											onClick={() =>
												setFilters((f) => ({ ...f, collectionId: null }))
											}
										>
											<Folder className="h-4 w-4" />
											<span className="flex-1">all bookmarks</span>
											<span className="text-xs text-muted-foreground">
												{MOCK_BOOKMARKS.length}
											</span>
										</SidebarMenuButton>
									</SidebarMenuItem>
									{MOCK_COLLECTIONS.map((col) => (
										<SidebarMenuItem key={col.id}>
											<SidebarMenuButton
												isActive={filters.collectionId === col.id}
												onClick={() =>
													setFilters((f) => ({ ...f, collectionId: col.id }))
												}
											>
												<col.icon
													className="h-4 w-4"
													style={{ color: col.color || undefined }}
												/>
												<span className="flex-1">{col.name}</span>
												<span className="text-xs text-muted-foreground">
													{col.count}
												</span>
											</SidebarMenuButton>
										</SidebarMenuItem>
									))}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>

						{/* TAGS */}
						<SidebarGroup>
							<div className="flex items-center justify-between px-2">
								<SidebarGroupLabel>tags</SidebarGroupLabel>
								<Button variant="ghost" size="icon-sm">
									<Plus className="h-4 w-4" />
								</Button>
							</div>
							<SidebarGroupContent>
								<SidebarMenu>
									{MOCK_TAGS.map((tag) => {
										const isSelected = filters.tagIds.includes(tag.id);
										return (
											<SidebarMenuItem key={tag.id}>
												<SidebarMenuButton
													isActive={isSelected}
													onClick={() =>
														setFilters((f) => ({
															...f,
															tagIds: isSelected
																? f.tagIds.filter((id) => id !== tag.id)
																: [...f.tagIds, tag.id],
														}))
													}
												>
													<Tag
														className="h-4 w-4"
														style={{ color: tag.color || undefined }}
													/>
													<span className="flex-1">{tag.name}</span>
													<span className="text-xs text-muted-foreground">
														{tag.count}
													</span>
												</SidebarMenuButton>
											</SidebarMenuItem>
										);
									})}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					</SidebarContent>
				</Sidebar>

				{/* MAIN CONTENT */}
				<main className="flex-1 flex flex-col overflow-hidden">
					{/* TOP BAR */}
					<header className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
						<div className="flex h-14 items-center gap-4 px-4">
							<SidebarTrigger />

							{/* SEARCH */}
							<div className="flex-1 max-w-2xl">
								<div className="relative">
									<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
									<Input
										type="search"
										placeholder="search bookmarks..."
										className="pl-9 w-full"
										value={filters.search}
										onChange={(e) =>
											setFilters((f) => ({ ...f, search: e.target.value }))
										}
									/>
								</div>
							</div>

							{/* ACTIONS */}
							<div className="flex items-center gap-2">
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="outline" size="sm">
											sort: {filters.sort.replace("_", " ")}
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem
											onClick={() =>
												setFilters((f) => ({ ...f, sort: "created_desc" }))
											}
										>
											newest first
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() =>
												setFilters((f) => ({ ...f, sort: "created_asc" }))
											}
										>
											oldest first
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() =>
												setFilters((f) => ({ ...f, sort: "title_asc" }))
											}
										>
											title a-z
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() =>
												setFilters((f) => ({ ...f, sort: "title_desc" }))
											}
										>
											title z-a
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
								<Button size="sm">
									<Plus className="h-4 w-4" />
									new
								</Button>
								<ModeToggle />
							</div>
						</div>
					</header>

					{/* CONTENT AREA */}
					<div className="flex-1 overflow-auto">
						<div className="p-6">
							{/* HEADER + ACTIVE FILTERS */}
							<div className="mb-6">
								<div className="flex items-center justify-between mb-3">
									<div>
										<h1 className="text-2xl font-bold">
											{selectedCollection?.name || "all bookmarks"}
										</h1>
										<p className="text-sm text-muted-foreground mt-1">
											{filteredBookmarks.length} items
										</p>
									</div>

									{/* QUICK FILTERS */}
									<div className="flex gap-2">
										<Button
											variant={
												filters.isFavorite === true ? "default" : "outline"
											}
											size="sm"
											onClick={() =>
												setFilters((f) => ({
													...f,
													isFavorite: f.isFavorite === true ? null : true,
												}))
											}
										>
											<Star className="h-4 w-4" />
											favorites
										</Button>
									</div>
								</div>

								{/* ACTIVE FILTER CHIPS */}
								{(selectedTags.length > 0 || filters.search) && (
									<div className="flex flex-wrap gap-2">
										{filters.search && (
											<div className="inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-sm">
												search: "{filters.search}"
												<button
													onClick={() =>
														setFilters((f) => ({ ...f, search: "" }))
													}
													className="hover:bg-background rounded-sm p-0.5"
												>
													×
												</button>
											</div>
										)}
										{selectedTags.map((tag) => (
											<div
												key={tag.id}
												className="inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-sm"
												style={{ backgroundColor: `${tag.color}20` }}
											>
												<Tag className="h-3 w-3" style={{ color: tag.color }} />
												{tag.name}
												<button
													onClick={() =>
														setFilters((f) => ({
															...f,
															tagIds: f.tagIds.filter((id) => id !== tag.id),
														}))
													}
													className="hover:bg-background rounded-sm p-0.5"
												>
													×
												</button>
											</div>
										))}
									</div>
								)}
							</div>

							{/* BOOKMARK GRID */}
							{isLoading ? (
								<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
									{Array.from({ length: 6 }).map((_, i) => (
										<div key={i} className="space-y-3 p-4 border rounded-lg">
											<Skeleton className="h-4 w-3/4" />
											<Skeleton className="h-3 w-full" />
											<Skeleton className="h-3 w-2/3" />
										</div>
									))}
								</div>
							) : filteredBookmarks.length === 0 ? (
								<div className="flex flex-col items-center justify-center py-12 text-center">
									<Folder className="h-12 w-12 text-muted-foreground mb-4" />
									<h3 className="text-lg font-medium mb-1">
										no bookmarks found
									</h3>
									<p className="text-sm text-muted-foreground mb-4">
										try adjusting your filters or create a new bookmark
									</p>
									<Button>
										<Plus className="h-4 w-4" />
										add bookmark
									</Button>
								</div>
							) : (
								<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
									{filteredBookmarks.map((bookmark) => (
										<BookmarkCard
											key={bookmark.id}
											bookmark={bookmark}
											onEdit={() => console.log("edit", bookmark.id)}
										/>
									))}
								</div>
							)}
						</div>
					</div>
				</main>
			</div>
		</SidebarProvider>
	);
}

//
//
//
// export function Dashboard() {
// 	return (
// 		<div className="space-y-6">
// 			<h1 className="text-3xl font-bold">dashboard</h1>
// 			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
// 				<Card>
// 					<CardHeader>
// 						<CardTitle>metric 1</CardTitle>
// 						<CardDescription>some description</CardDescription>
// 					</CardHeader>
// 					<CardContent>
// 						<div className="text-2xl font-bold">1,234</div>
// 					</CardContent>
// 				</Card>
// 				<Card>
// 					<CardHeader>
// 						<CardTitle>metric 2</CardTitle>
// 						<CardDescription>another metric</CardDescription>
// 					</CardHeader>
// 					<CardContent>
// 						<Button>action</Button>
// 					</CardContent>
// 				</Card>
// 			</div>
// 		</div>
// 	);
// }
// src/pages/dashboard.tsx
// const MOCK_BOOKMARKS = [
// 	{
// 		id: "1",
// 		title: "example",
// 		url: "https://example.com",
// 		tags: ["design", "ui"],
// 		isFavorite: false,
// 		createdAt: new Date().toISOString(),
// 	},
// ];
//
// export function Dashboard() {
// 	// layout: sidebar + main content
// 	// sidebar: collections list, tags list
// 	// main: search bar, filter chips, bookmark grid
// 	// use your BookmarkCard component
// }
