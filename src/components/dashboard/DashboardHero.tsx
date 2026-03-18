type Props = {
  title: string;
  subtitle: string;
};

export default function DashboardHero({ title, subtitle }: Props) {
  return (
    <div className="hero-card">
      <h1 className="hero-title">{title}</h1>
      <p className="hero-subtitle">{subtitle}</p>
    </div>
  );
}