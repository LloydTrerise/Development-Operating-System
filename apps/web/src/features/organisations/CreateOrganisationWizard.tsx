import { useState, type FormEvent } from 'react';
import { Box, Button, Step, StepLabel, Stepper, TextField, Typography } from '@mui/material';
import { createOrganisation, type Organisation } from '../../api-client.js';
import { ErrorAlert } from '../../components/ErrorAlert.js';
import { useSession } from '../../session.js';

const STEPS = ['Registration token', 'Organisation details'];

/**
 * DEVOS-341 (Sprint 60, candidate epic E31 part 5): replaces
 * `OrganisationsPage.tsx`'s own former flat "New organisation" form
 * (name/slug/registrationToken in one step, no disclosure of the Admin side
 * effect) with a two-step guided flow. `createOrganisation`'s own call
 * signature and the server-side registration-token gate (Sprint 57) are
 * unchanged — this component only changes how the same call is presented.
 */
export function CreateOrganisationWizard({
  onCreated,
}: {
  onCreated: (organisation: Organisation) => void;
}) {
  const session = useSession();
  const currentPrincipalId = 'principalId' in session ? session.principalId : '';

  const [activeStep, setActiveStep] = useState(0);
  const [registrationToken, setRegistrationToken] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setActiveStep(0);
    setRegistrationToken('');
    setName('');
    setSlug('');
    setSubmitError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const result = await createOrganisation({ name, slug, registrationToken });
    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error.message);
      return;
    }

    onCreated(result.data);
    reset();
  }

  return (
    <Box sx={{ maxWidth: 480 }}>
      <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {activeStep === 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Registration token"
            value={registrationToken}
            onChange={(event) => setRegistrationToken(event.target.value)}
            required
            size="small"
            autoFocus
            helperText="Ask a platform operator to issue you a registration token."
          />
          <Button
            variant="contained"
            disabled={!registrationToken.trim()}
            onClick={() => setActiveStep(1)}
            sx={{ alignSelf: 'flex-start' }}
          >
            Next
          </Button>
        </Box>
      )}

      {activeStep === 1 && (
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <TextField
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            size="small"
            autoFocus
          />
          <TextField
            label="Slug"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            required
            size="small"
          />
          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
            Creating this organisation will make you ({currentPrincipalId}) its Admin.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => setActiveStep(0)} disabled={submitting}>
              Back
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting || !name.trim() || !slug.trim()}
            >
              {submitting ? 'Creating…' : "Create organisation — you'll be its Admin"}
            </Button>
          </Box>
          {submitError && <ErrorAlert message={submitError} />}
        </Box>
      )}
    </Box>
  );
}
