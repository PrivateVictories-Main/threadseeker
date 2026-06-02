// Wire @testing-library/jest-dom's custom matchers (toBeInTheDocument,
// toHaveClass, ...) into vitest's expect. Without this the package was a
// declared-but-unused dep and component tests fell back to .toBeDefined(),
// which never fails on a querySelector miss (null IS defined).
import "@testing-library/jest-dom/vitest";
