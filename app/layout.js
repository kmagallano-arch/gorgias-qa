import './globals.css';

export const metadata = {
  title: 'Ticket Grader - Gorgias',
  description: 'AI-powered ticket grading for Gorgias',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
