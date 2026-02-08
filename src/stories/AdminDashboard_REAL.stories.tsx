import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import AdminDashboard from "@/pages/AdminDashboard";

import { createMemoryRouter, RouterProvider } from "react-router-dom";

const meta: Meta = {
  title: "PAGES/Admin/AdminDashboard (REAL)",
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const router = createMemoryRouter(
      [{ path: "/", element: <AdminDashboard /> }],
      {
        initialEntries: ["/"],
        future: {
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        },
      }
    );

    return <RouterProvider router={router} />;
  },
};
