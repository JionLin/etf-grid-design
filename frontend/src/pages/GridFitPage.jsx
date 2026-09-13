import { Helmet } from "react-helmet-async";
import GridFitBoard from "@features/analysis/components/ReportCards/GridFitBoard";

export default function GridFitPage() {
  return (
    <>
      <Helmet>
        <title>网格适合度榜 - ETFer.Top</title>
      </Helmet>
      <GridFitBoard />
    </>
  );
}
