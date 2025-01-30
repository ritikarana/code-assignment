"use client";

import type { ZodType } from "zod";
import { z } from "zod";

import type { RouterOutputs } from "@inf/api";
import type { Insertable } from "@inf/db/helpers";
import type { posts } from "@inf/db/types";
import { cn } from "@inf/ui";
import { Button } from "@inf/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  useForm,
} from "@inf/ui/form";
import { Input } from "@inf/ui/input";
import { toast } from "@inf/ui/toast";

import { api } from "~/trpc/react";
import { useMemo, useState, memo } from "react"
import { EditablePostTitle } from "./EditablePostTitle";

export function CreatePostForm() {

  // Validation schema
  const formSchema = z.object({
    title: z
      .string()
      .min(5, { message: "Title must be at least 5 characters long" })
      .max(100, { message: "Title cannot exceed 100 characters" }),
    content: z
      .string()
      .min(10, { message: "Content must be at least 10 characters long" })
      .max(1000, { message: "Content cannot exceed 1000 characters" }),
    author_id: z.string().min(1, { message: "Author ID is required" }),
  }) satisfies ZodType<Insertable<posts>>;

  const form = useForm({
    schema: formSchema,
    defaultValues: {
      content: "",
      title: "",
      author_id: "",
    },
  });

  const utils = api.useUtils();
  const createPost = api.post.create.useMutation({
    onSuccess: async () => {
      form.reset();
      await utils.post.invalidate();
      toast.success("Post created successfully!");
    },
    onError: (err) => {
      toast.error(
        err.data?.code === "UNAUTHORIZED"
          ? "You must be logged in to create a post"
          : "Failed to create post",
      );
    },
  });

  return (
    <Form {...form}>
      <form
        data-testid="post-form"
        className="flex w-full max-w-2xl flex-col gap-4"
        action={"/"}
        onSubmit={form.handleSubmit((data) => {
          createPost.mutate(data);
        })}
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input {...field} placeholder="Enter a Title..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input {...field} placeholder="Share your thoughts here..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Author ID Field */}
        <FormField
          control={form.control}
          name="author_id"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input {...field} placeholder="Enter your author ID" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Create</Button>
      </form>
    </Form>
  );
}

export function PostList() {
  // Destructure isFetching
  const { data: posts = [], isFetching } = api.post.all.useQuery();

  // Memoize posts to avoid unnecessary recalculations
  const memoizedPosts = useMemo(() => posts, [posts]);

  if (isFetching) {
    return (
      <div className="flex w-full flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <PostCardSkeleton key={i} pulse />
        ))}
      </div>
    );
  }


  if (memoizedPosts.length === 0) {
    return (
      <div className="relative flex min-h-16 w-full flex-col gap-4">
        {!isFetching && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-2xl font-bold text-stone-500/[0.5]">
              No posts yet
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {memoizedPosts.map((p) => {
        return <PostCard key={p.id} post={p} />;
      })}
    </div>
  );
}

export const PostCard = memo(function PostCard(props: { post: RouterOutputs["post"]["all"][number] }) {
  const { title, content, author_id, id } = props.post;
  const utils = api.useUtils();
  const [isDeleting, setIsDeleting] = useState(false);

  const [isEditing, setIsEditing] = useState(false);

  const deletePost = api.post.delete.useMutation({
    onSuccess: async () => {
      await utils.post.all.invalidate();
      await utils.post.byId.invalidate({ id });
    },
    onError: (err) => {
      if (err.data?.code === "UNAUTHORIZED") {
        toast.error("You must be logged in to delete a post");
      } else if (err.data?.code === "NOT_FOUND") {
        toast.error("Post not found or already deleted");
      } else {
        toast.error("An unexpected error occurred. Please try again.");
      }
    },
  });

  const handleDelete = async () => {
    const confirmed = window.confirm("Are you sure you want to delete this post?");
    if (!confirmed) return;

    setIsDeleting(true);
    await deletePost.mutateAsync({ id });
    setIsDeleting(false);
  };

  const handleEdit = () => {
    setIsEditing(true); // Set to true to enable editing mode for title
  };

  return (
    <div className="flex flex-row rounded-lg bg-muted p-4">
      <div className="flex-grow">
        <EditablePostTitle
          value={title}
          createdDate={new Date()}
          updatedDate={new Date()}
          onSave={(newTitle) => {
            console.log("New Title:", newTitle);
            // Add save functionality here
            setIsEditing(false); // Set to false after saving
          }}
          onClick={handleEdit} // Handle title click to enable editing
        />
        <p className="mt-2 text-sm">{content}</p>
        <p className="mt-2 text-xs">Posted by {author_id}</p>
      </div>
      <div>
        <Button
          variant="ghost"
          className="cursor-pointer text-sm font-bold uppercase text-primary hover:bg-transparent hover:text-black"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </Button>
      </div>
    </div>
  );
});


export function PostCardSkeleton(props: { pulse?: boolean }) {
  const { pulse = true } = props;
  return (
    <div className="flex flex-row rounded-lg bg-muted p-4">
      <div className="flex-grow">
        <h2
          className={cn(
            "w-1/4 rounded bg-stone-500/[0.2] text-2xl font-bold",
            pulse && "animate-pulse",
          )}
        >
          &nbsp;
        </h2>
        <p
          className={cn(
            "mt-2 w-1/3 rounded bg-stone-500/[0.2] text-sm",
            pulse && "animate-pulse",
          )}
        >
          &nbsp;
        </p>
      </div>
    </div>
  );
}