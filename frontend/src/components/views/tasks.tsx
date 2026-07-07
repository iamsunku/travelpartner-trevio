"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent, useDraggable, useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, Calendar, Link2, MessageCircle, Paperclip, AlertTriangle,
  CheckCircle2, ListTodo, Loader, Eye, User,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useDemoDataStore } from "@/store/demo-data-store";
import { useAuthStore } from "@/store/app-store";
import type { Task } from "@/types";
import {
  PageHeader, StatusBadge, initials, avatarGradient,
} from "@/components/shared/ui-helpers";
import { cn } from "@/lib/utils";

const COLUMNS = [
  { id: "To Do", label: "To Do", icon: ListTodo, color: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300" },
  { id: "In Progress", label: "In Progress", icon: Loader, color: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  { id: "Review", label: "Review", icon: Eye, color: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  { id: "Completed", label: "Completed", icon: CheckCircle2, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
] as const;

const PRIORITY_STYLES: Record<string, string> = {
  Urgent: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  High: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  Medium: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  Low: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
};
const PRIORITY_DOT: Record<string, string> = {
  Urgent: "bg-rose-500", High: "bg-amber-500", Medium: "bg-sky-500", Low: "bg-slate-400",
};

function isOverdue(dateStr: string) {
  const due = new Date(dateStr);
  const today = new Date("2025-01-21");
  return due < today;
}

export function TasksView() {
  const { toast } = useToast();
  const tasks = useDemoDataStore((s) => s.tasks);
  const updateTaskStatus = useDemoDataStore((s) => s.updateTaskStatus);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const grouped = useMemo(() => {
    const map: Record<string, Task[]> = { "To Do": [], "In Progress": [], Review: [], Completed: [] };
    tasks.forEach((t) => { (map[t.status] || (map[t.status] = [])).push(t); });
    return map;
  }, [tasks]);

  const activeTask = tasks.find((t) => t.id === activeId) || null;

  const total = tasks.length;
  const todo = tasks.filter((t) => t.status === "To Do").length;
  const inProgress = tasks.filter((t) => t.status === "In Progress").length;
  const overdue = tasks.filter((t) => t.status !== "Completed" && isOverdue(t.dueDate)).length;
  const completedThisWeek = tasks.filter((t) => t.status === "Completed").length;

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const newStatus = String(over.id);
    const task = tasks.find((t) => t.id === active.id);
    if (!task || task.status === newStatus) return;
    updateTaskStatus(task.id, newStatus as Task["status"]);
    toast({
      title: "Task moved",
      description: `"${task.title}" → ${newStatus}`,
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tasks"
        subtitle="Drag-and-drop your team's task board"
        action={
          <Button onClick={() => setAssignOpen(true)} className="bg-teal-600 hover:bg-teal-700">
            <Plus className="w-4 h-4 mr-1.5" /> Assign Task
          </Button>
        }
      />

      {/* Stat chips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { icon: ListTodo, label: "Total", value: total, color: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400" },
          { icon: ListTodo, label: "To Do", value: todo, color: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300" },
          { icon: Loader, label: "In Progress", value: inProgress, color: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400" },
          { icon: AlertTriangle, label: "Overdue", value: overdue, color: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" },
          { icon: CheckCircle2, label: "Done (Week)", value: completedThisWeek, color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="p-3 flex items-center gap-2.5">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", s.color)}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div>
                  <p className="text-lg font-bold leading-tight">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {COLUMNS.map((col) => (
            <Column key={col.id} col={col} tasks={grouped[col.id] || []} onOpenTask={setDetailTask} />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? (
            <div className="rotate-3 opacity-90">
              <TaskCard task={activeTask} onOpen={() => {}} dragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <AssignTaskDialog open={assignOpen} onOpenChange={setAssignOpen} />
      <TaskDetailDialog task={detailTask} onClose={() => setDetailTask(null)} />
    </div>
  );
}

function Column({
  col, tasks, onOpenTask,
}: {
  col: typeof COLUMNS[number];
  tasks: Task[];
  onOpenTask: (t: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  const Icon = col.icon;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-xl border border-border bg-muted/30 p-2.5 transition-colors min-h-[200px]",
        isOver && "border-teal-400 bg-teal-50 dark:bg-teal-500/10 ring-2 ring-teal-400/30",
      )}
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className={cn("w-6 h-6 rounded-md flex items-center justify-center", col.color)}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <span className="text-sm font-semibold">{col.label}</span>
        </div>
        <Badge variant="secondary" className="text-[10px] h-5">{tasks.length}</Badge>
      </div>
      <div className="space-y-2 max-h-[60vh] overflow-y-auto scroll-thin pr-0.5">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} onOpen={() => onOpenTask(t)} />
        ))}
        {tasks.length === 0 && (
          <div className="text-center text-[11px] text-muted-foreground py-8 border-2 border-dashed border-border/60 rounded-lg">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
}

function TaskCard({ task, onOpen, dragging }: { task: Task; onOpen: () => void; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };
  const overdue = task.status !== "Completed" && isOverdue(task.dueDate);

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      {...attributes}
      {...listeners}
      onClick={(e) => { if (!isDragging) { e.stopPropagation(); onOpen(); } }}
      className={cn(
        "group rounded-lg border border-border bg-card p-2.5 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/40 transition-all",
        dragging && "shadow-lg",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <Badge variant="secondary" className={cn("text-[9px] h-4 px-1.5 font-medium", PRIORITY_STYLES[task.priority])}>
          <span className={cn("w-1.5 h-1.5 rounded-full mr-1", PRIORITY_DOT[task.priority])} />
          {task.priority}
        </Badge>
        {overdue && <AlertTriangle className="w-3 h-3 text-rose-500" />}
      </div>
      <p className="text-xs font-medium leading-snug line-clamp-2 mb-2">{task.title}</p>
      {task.relatedTo && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1.5">
          <Link2 className="w-2.5 h-2.5" />
          <span className="font-mono">{task.relatedTo}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Avatar className="w-5 h-5">
            <AvatarFallback className={cn("bg-gradient-to-br text-white text-[8px] font-semibold", avatarGradient(task.assignedTo))}>
              {initials(task.assignedTo)}
            </AvatarFallback>
          </Avatar>
          <span className="text-[10px] text-muted-foreground truncate max-w-[70px]">{task.assignedTo.split(" ")[0]}</span>
        </div>
        <span className={cn("text-[10px] flex items-center gap-0.5", overdue ? "text-rose-500 font-medium" : "text-muted-foreground")}>
          <Calendar className="w-2.5 h-2.5" />
          {task.dueDate.slice(5)}
        </span>
      </div>
    </motion.div>
  );
}

const ASSIGNEES = ["Sneha Reddy", "Rahul Khanna", "Deepa Rao", "Aisha Khan", "Vikram Iyer", "Nikhil Joshi", "Priya Nair"];

function AssignTaskDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const addTask = useDemoDataStore((s) => s.addTask);
  const user = useAuthStore((s) => s.user);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("Sneha Reddy");
  const [priority, setPriority] = useState<Task["priority"]>("High");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [relatedTo, setRelatedTo] = useState("");

  const handleSubmit = () => {
    if (!title.trim()) {
      toast({ title: "Title required", description: "Enter a task title.", variant: "destructive" });
      return;
    }
    addTask({
      title: title.trim(),
      description: description.trim(),
      assignedTo,
      assignedBy: user?.name || "System",
      priority,
      dueDate,
      relatedTo: relatedTo.trim() || undefined,
    });
    toast({ title: "Task assigned", description: "The task has been created and assigned." });
    setTitle("");
    setDescription("");
    setRelatedTo("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Assign New Task</DialogTitle>
          <DialogDescription>Delegate work to a team member with priorities and deadlines.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Task Title</Label>
            <Input placeholder="e.g. Follow up with customer for payment" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea placeholder="Add context, links, or instructions..." rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Assignee</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASSIGNEES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Task["priority"])}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Urgent", "High", "Medium", "Low"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Related To (optional)</Label>
              <Input placeholder="BK-XXXX / LD-X" value={relatedTo} onChange={(e) => setRelatedTo(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} className="bg-teal-600 hover:bg-teal-700">Assign Task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const MOCK_COMMENTS = [
  { user: "Arjun Nair", text: "Please prioritize this — customer is following up daily.", time: "2h ago" },
  { user: "Sneha Reddy", text: "Working on revised quote, will share by EOD.", time: "1h ago" },
];
const MOCK_ATTACHMENTS = [
  { name: "Bali_Quotation_v2.pdf", size: "245 KB" },
  { name: "Villa_Options.xlsx", size: "88 KB" },
];

function TaskDetailDialog({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const { toast } = useToast();
  const [comment, setComment] = useState("");
  if (!task) return null;
  const overdue = task.status !== "Completed" && isOverdue(task.dueDate);

  const sendComment = () => {
    if (!comment.trim()) return;
    toast({ title: "Comment posted", description: "Your comment has been added." });
    setComment("");
  };

  return (
    <Dialog open={!!task} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className={cn("text-[10px] font-medium", PRIORITY_STYLES[task.priority])}>{task.priority}</Badge>
            <StatusBadge status={task.status} />
            {overdue && <Badge variant="secondary" className="text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400">Overdue</Badge>}
          </div>
          <DialogTitle className="text-base leading-snug pt-1">{task.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-1.5">
          <p className="text-sm text-muted-foreground leading-relaxed">{task.description}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg border border-border p-2.5">
            <p className="text-[10px] text-muted-foreground mb-1">Assigned To</p>
            <div className="flex items-center gap-2">
              <Avatar className="w-6 h-6">
                <AvatarFallback className={cn("bg-gradient-to-br text-white text-[9px] font-semibold", avatarGradient(task.assignedTo))}>
                  {initials(task.assignedTo)}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">{task.assignedTo}</span>
            </div>
          </div>
          <div className="rounded-lg border border-border p-2.5">
            <p className="text-[10px] text-muted-foreground mb-1">Assigned By</p>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{task.assignedBy}</span>
            </div>
          </div>
          <div className="rounded-lg border border-border p-2.5">
            <p className="text-[10px] text-muted-foreground mb-1">Due Date</p>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className={cn("font-medium", overdue && "text-rose-600")}>{task.dueDate}</span>
            </div>
          </div>
          <div className="rounded-lg border border-border p-2.5">
            <p className="text-[10px] text-muted-foreground mb-1">Related To</p>
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-muted-foreground" />
              <span className="font-mono">{task.relatedTo || "—"}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Attachments */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">Attachments</span>
          </div>
          <div className="space-y-1.5">
            {MOCK_ATTACHMENTS.map((a) => (
              <div key={a.name} className="flex items-center justify-between rounded-lg border border-border p-2 hover:bg-muted/40 transition-colors cursor-pointer">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-teal-100 dark:bg-teal-500/15 text-teal-600 flex items-center justify-center shrink-0">
                    <Paperclip className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{a.name}</p>
                    <p className="text-[10px] text-muted-foreground">{a.size}</p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs">Download</Button>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Comments */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <MessageCircle className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">Comments ({MOCK_COMMENTS.length})</span>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto scroll-thin">
            {MOCK_COMMENTS.map((c, i) => (
              <div key={i} className="flex gap-2">
                <Avatar className="w-6 h-6 shrink-0">
                  <AvatarFallback className={cn("bg-gradient-to-br text-white text-[9px] font-semibold", avatarGradient(c.user))}>
                    {initials(c.user)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="rounded-lg bg-muted px-2.5 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium">{c.user}</span>
                      <span className="text-[10px] text-muted-foreground">{c.time}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Add a comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendComment(); }}
              className="h-8 text-xs"
            />
            <Button size="sm" onClick={sendComment} className="h-8 bg-teal-600 hover:bg-teal-700">Send</Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
