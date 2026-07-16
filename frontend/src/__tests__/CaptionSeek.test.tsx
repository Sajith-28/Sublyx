import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Workspace } from "../components/Workspace";

const mockSegments = [
  { id: "seg-1", index: 0, start: 5.20, end: 8.40, text: "Welcome to Sublyx" },
  { id: "seg-2", index: 1, start: 15.50, end: 18.90, text: "Let's check the timing controls" },
];

describe("Caption Seek & Video Sync Logic", () => {
  it("should set HTML5 video currentTime to exactly 15.50 when clicking the second segment card", () => {
    const handleExport = jest.fn();
    const handleUpdateSegment = jest.fn();
    
    // Mount the Workspace containing VideoPlayer and CaptionEditor
    const { container } = render(
      <Workspace
        videoUrl="mock-video.mp4"
        segments={mockSegments}
        onUpdateSegment={handleUpdateSegment}
        onExport={handleExport}
      />
    );

    // Grab the HTML5 <video> element
    const videoElement = container.querySelector("video") as HTMLVideoElement;
    expect(videoElement).toBeInTheDocument();

    // Verify initial currentTime is 0
    expect(videoElement.currentTime).toBe(0);

    // Locate the segment block for Segment #2 (start time: 15.50)
    // The segment component lists Segment #2 and the text description
    const segmentCard = screen.getByText("Let's check the timing controls").closest(".group\\/card");
    expect(segmentCard).toBeInTheDocument();

    // Click the caption block (which triggers handleSeek)
    fireEvent.click(segmentCard!);

    // Assert that the HTML5 video currentTime has been set to exactly 15.50
    expect(videoElement.currentTime).toBe(15.50);
  });
  
  it("should prevent seeking when clicking inside the editing textarea", () => {
    const handleExport = jest.fn();
    const handleUpdateSegment = jest.fn();
    
    render(
      <Workspace
        videoUrl="mock-video.mp4"
        segments={mockSegments}
        onUpdateSegment={handleUpdateSegment}
        onExport={handleExport}
      />
    );

    // Find textarea within Segment #2
    const textareas = screen.getAllByPlaceholderText("Caption text...");
    const secondTextarea = textareas[1];
    
    // Set up a mock video element currentTime spy to confirm it doesn't change
    const videoElement = document.querySelector("video") as HTMLVideoElement;
    
    // Click inside the textarea to simulate writing/editing
    fireEvent.click(secondTextarea);

    // Assert that currentTime remains untouched (0) because click event propagation was stopped
    expect(videoElement.currentTime).toBe(0);
  });
});
