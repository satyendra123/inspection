import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import Test from "./Test";
import { checkPermission } from "../components/CheckPermission";

vi.mock("axios");
vi.mock("../components/CheckPermission", () => ({
  checkPermission: vi.fn(),
}));
vi.mock("../hooks/Icons", () => ({
  DeleteIcon: () => <span>delete</span>,
  EditIcon: () => <span>edit</span>,
}));

const mockedCheckPermission = vi.mocked(checkPermission);
const mockedAxiosGet = vi.mocked(axios.get);
const mockedAxiosPost = vi.mocked(axios.post);

const renderPage = () =>
  render(
    <MemoryRouter>
      <Test />
    </MemoryRouter>,
  );

describe("Test page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("token", "fake-token");
    mockedCheckPermission.mockReturnValue(true);
    mockedAxiosGet.mockResolvedValue({ data: { data: [] } });
  });

  it("loads and renders tests from API", async () => {
    mockedAxiosGet.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 1,
            test_name: "Compression",
            instrument: "Gauge",
            description: "Checks pressure",
            status: "active",
            document: null,
            attachment: [],
            test_icon: null,
          },
        ],
      },
    });

    renderPage();

    expect(await screen.findByText("Compression")).toBeInTheDocument();
    expect(screen.getByText("Gauge")).toBeInTheDocument();
    expect(screen.getByText("Checks pressure")).toBeInTheDocument();
  });

  it("shows validation message when required fields are missing", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Add Test" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const validationMessages = await screen.findAllByText("Test Name is required");
    expect(validationMessages.length).toBeGreaterThan(0);
    expect(mockedAxiosPost).not.toHaveBeenCalled();
  });

  it("creates a test successfully", async () => {
    mockedAxiosPost.mockResolvedValueOnce({ data: { ok: true } });

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Add Test" }));
    fireEvent.change(screen.getByPlaceholderText("Test Name"), {
      target: { value: "Leak Test" },
    });
    fireEvent.change(screen.getByPlaceholderText("Description"), {
      target: { value: "Leak detection flow" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mockedAxiosPost).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Test added successfully")).toBeInTheDocument();
  });
});
