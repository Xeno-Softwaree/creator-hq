import {validateDeploymentEnvironment} from '../../scripts/deployment-policy.mjs';
// Refuse to compile personal locations or URL credentials into a public-mode artifact.
const findings=validateDeploymentEnvironment(process.env);
if(findings.length)throw new Error(findings.map(({key,code})=>`${code}: ${key}`).join('; '));
export default {};
