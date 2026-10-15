interface PageCardProps {
  type: string;
  children: React.ReactNode;
}
function PageCard({ type, children }: PageCardProps) {
  return <div className={`p-card c-${type}`}>{children}</div>;
}
export default PageCard;
