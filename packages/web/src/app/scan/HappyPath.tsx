import styled from "styled-components";

import { ThemeColorVariables } from "@xliic/common/theme";
import Response from "../../components/response/Response";
import { safeParseResponse } from "../../http-parser";
import CurlRequest from "./CurlRequest";
import { HappyPathReport } from "@xliic/common/scan-report";

export function HappyPath({ report }: { report: HappyPathReport }) {
  const { request, response, outcome, happyPath } = report;

  let responsePayloadMatchesContract = "N/A";

  const responseCodeFound = outcome?.status === "correct" ? "Yes" : "No";

  if (responseCodeFound === "Yes") {
    responsePayloadMatchesContract = outcome?.conformant ? "Yes" : "No";
  }

  const excessiveDataExposure = outcome?.excessiveDataExposure;

  const responseAnalysis = outcome?.apiResponseAnalysis || [];

  return (
    <Container>
      <Item>
        <div>HTTP code received</div>
        <div>
          {response?.httpStatusCode} (Expected: {happyPath?.httpStatusExpected?.join(", ")})
        </div>
      </Item>

      <Item>
        <div>Response code found in API Contract</div>
        <div>{responseCodeFound}</div>
      </Item>

      <Item>
        <div>Response matches API Contract</div>
        <div>{responsePayloadMatchesContract}</div>
      </Item>

      <Item>
        <div>Excessive data exposure found</div>
        <div>{excessiveDataExposure ? "Yes" : "No"}</div>
      </Item>

      {responseAnalysis.length > 0 && (
        <Item>
          <div>Response Analysis</div>
          <div>
            {responseAnalysis.map((analysis, index) => (
              <div key={index}>{analysis.responseDescription}</div>
            ))}
          </div>
        </Item>
      )}

      {request?.curl && (
        <Item>
          <div>Request</div>
          <div>
            <CurlRequest curl={request?.curl} />
          </div>
        </Item>
      )}

      {response?.rawPayload && (
        <Item>
          <div>Response</div>
          <div>
            <Response accented response={safeParseResponse(response!.rawPayload)} />
          </div>
        </Item>
      )}

      {outcome?.error && (
        <Item>
          <div>Error</div>
          <div>{outcome?.error}</div>
        </Item>
      )}
    </Container>
  );
}

const Container = styled.div`
  margin: 8px;
  border: 1px solid var(${ThemeColorVariables.border});
`;

const Failed = styled.div`
  margin: 16px;
`;

const Item = styled.div`
  display: flex;
  padding: 8px;
  gap: 8px;
  & > div:first-child {
    flex: 1;
    opacity: 0.8;
  }
  & > div:last-child {
    line-break: anywhere;
    flex: 3;
  }
`;
