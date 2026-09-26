import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <section className="section grid min-h-[60vh] place-items-center">
      <div className="card max-w-lg p-8 text-center shadow-lift animate-fade-up">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-teal-50 text-civic ring-4 ring-teal-100">
          <Compass size={26} />
        </span>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-ink">Page not found</h1>
        <p className="mt-2 text-slate-600">This route is not part of the Nagar Setu workspace.</p>
        <Link to="/" className="btn-primary mt-6">Go home</Link>
      </div>
    </section>
  );
}
